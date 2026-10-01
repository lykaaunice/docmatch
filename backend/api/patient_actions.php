<?php
require_once __DIR__ . '/../db.php';
require_login(['patient']);

$d = json_input();
$action = $d['action'] ?? '';
$id = (int)($d['appointment_id'] ?? 0);

try {
    // Only allow changes to appointments owned by the signed-in patient.
    $s = $pdo->prepare("SELECT * FROM appointments WHERE id = ? AND patient_id = ?");
    $s->execute([$id, $_SESSION['user_id']]);
    $app = $s->fetch();
    if (!$app) json_out(['success' => false, 'message' => 'Appointment not found.'], 404);
    if ($app['status'] === 'Cancelled') json_out(['success' => false, 'message' => 'This appointment is already cancelled.'], 409);

    // Handle patient response to a proposed follow-up schedule.
    if ($action === 'confirm_followup' || $action === 'decline_followup') {
        if ($app['status'] !== 'Proposed' || !(int)$app['patient_notified']) {
            json_out(['success' => false, 'message' => 'There is no follow-up to confirm.'], 409);
        }
        $when = "{$app['appointment_date']} " . substr($app['appointment_time'], 0, 5);
        if ($action === 'confirm_followup') {
            $pdo->prepare("UPDATE appointments SET status = 'Booked' WHERE id = ?")->execute([$id]);
            $msg = "The patient confirmed the follow-up: {$app['patient_name']} - $when ({$app['reference_code']}).";
            notify($pdo, 'coordinator', null, 'Follow-up Confirmed', $msg);
            notify_doctor($pdo, (int)$app['doctor_id'], 'Follow-up Confirmed', $msg);
        } else {
            $reason = trim($d['reason'] ?? '');
            $pdo->prepare("UPDATE appointments SET status = 'Cancelled', cancel_reason = ? WHERE id = ?")
                ->execute([$reason !== '' ? $reason : null, $id]);
            if ($app['parent_id']) $pdo->prepare("UPDATE appointments SET followup_relayed = 0 WHERE id = ?")->execute([$app['parent_id']]);
            notify($pdo, 'coordinator', null, 'Follow-up Declined',
                "{$app['patient_name']} ({$app['reference_code']}) declined $when." . ($reason !== '' ? " Reason: $reason" : '') . ' Please suggest another date.');
        }
        json_out(['success' => true]);
    }

    // Patients may cancel their own active appointment.
    if ($action === 'cancel') {
        $reason = trim($d['reason'] ?? '');
        $pdo->prepare("UPDATE appointments SET status = 'Cancelled', cancel_reason = ? WHERE id = ?")
            ->execute([$reason !== '' ? $reason : null, $id]);
        $msg = "{$app['patient_name']} ({$app['reference_code']}) cancelled {$app['appointment_date']} " .
               substr($app['appointment_time'], 0, 5) . '. The slot is now free.' . ($reason !== '' ? " Reason: $reason" : '');
        notify_doctor($pdo, (int)$app['doctor_id'], 'Patient Cancelled', $msg);
        notify($pdo, 'coordinator', null, 'Patient Cancelled', $msg);
        json_out(['success' => true]);

    } elseif ($action === 'reschedule') {
        $date = $d['new_date'] ?? ''; $time = $d['new_time'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) {
            json_out(['success' => false, 'message' => 'Invalid date.'], 422);
        }
        if (preg_match('/^\d{2}:\d{2}$/', $time)) $time .= ':00';
        $problem = slot_problem($pdo, (int)$app['doctor_id'], $date, $time, $id);
        if ($problem) json_out(['success' => false, 'message' => $problem], 409);

        $pdo->prepare("INSERT INTO appointment_reschedule_history(appointment_id,old_date,old_time,new_date,new_time,changed_by_user_id) VALUES(?,?,?,?,?,?)")
            ->execute([$id,$app['appointment_date'],$app['appointment_time'],$date,$time,(int)$_SESSION['user_id']]);

        // Preserve the current workflow state after a patient update.
        // Reassignment cases return to the coordinator queue.
        if ($app['status'] === 'Needs_Reassignment') {
            $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ?, status = 'Pending', forwarded_to_doctor = 0, decline_reason = NULL WHERE id = ?")
                ->execute([$date, $time, $id]);
        } else {
            $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE id = ?")
                ->execute([$date, $time, $id]);
        }
        $msg = "{$app['patient_name']} ({$app['reference_code']}): {$app['appointment_date']} " . substr($app['appointment_time'], 0, 5) .
               " → $date " . substr($time, 0, 5) . '. The old slot is now free.';
        notify_doctor($pdo, (int)$app['doctor_id'], 'Patient Rescheduled', $msg);
        notify($pdo, 'coordinator', null, 'Patient Rescheduled', $msg);
        json_out(['success' => true]);
    }
    json_out(['success' => false, 'message' => 'Invalid action.'], 422);
} catch (Throwable $e) {
    fail($e);
}
