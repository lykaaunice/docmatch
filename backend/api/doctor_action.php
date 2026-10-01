<?php
require_once __DIR__ . '/../db.php';
require_login(['doctor']);

try {
    $data = json_input();
    $appointmentId = (int)($data['appointment_id'] ?? 0);
    $action = strtolower(trim((string)($data['action'] ?? '')));
    $reason = trim((string)($data['reason'] ?? ''));
    $period = trim((string)($data['followup_period'] ?? ''));
    $notes = trim((string)($data['followup_notes'] ?? ''));

    if (!$appointmentId) json_out(['success' => false, 'message' => 'Missing appointment ID.'], 422);

    // Doctors can only update appointments assigned to their account.
    $q = $pdo->prepare("SELECT * FROM appointments WHERE id = ? AND doctor_id = ?");
    $q->execute([$appointmentId, (int)$_SESSION['doctor_id']]);
    $app = $q->fetch();
    if (!$app) json_out(['success' => false, 'message' => 'Appointment not found for this doctor.'], 404);

    if ($action === 'accept' || $action === 'approved') {
        if ($app['status'] !== 'Pending' || !(int)$app['forwarded_to_doctor']) {
            json_out(['success' => false, 'message' => 'This appointment is not awaiting your review.'], 409);
        }
        $pdo->prepare("UPDATE appointments SET status = 'Booked' WHERE id = ?")->execute([$appointmentId]);
        notify($pdo, 'coordinator', null, 'Doctor Accepted Appointment',
            "The doctor accepted {$app['reference_code']}. Please notify the patient of the confirmation.");
        log_activity($pdo, $appointmentId, 'doctor_accepted', 'Doctor accepted the appointment.');
        json_out(['success' => true, 'message' => 'Appointment accepted. Waiting for coordinator confirmation to the patient.']);
    }

    if ($action === 'decline') {
        if ($app['status'] !== 'Pending' || !(int)$app['forwarded_to_doctor']) {
            json_out(['success' => false, 'message' => 'This appointment is not awaiting your review.'], 409);
        }
        $pdo->prepare("UPDATE appointments SET status = 'Declined', decline_reason = ?, needs_reassignment = 1 WHERE id = ?")
            ->execute([$reason !== '' ? $reason : null, $appointmentId]);
        notify($pdo, 'coordinator', null, 'Doctor Declined Appointment',
            "The doctor declined {$app['reference_code']}. Reassignment is required.");
        log_activity($pdo, $appointmentId, 'doctor_declined', $reason);
        json_out(['success' => true, 'message' => 'Appointment declined.']);
    }

    if ($action === 'complete' || $action === 'consultation_done') {
        if ($app['status'] !== 'Checked_In') {
            json_out(['success' => false, 'message' => 'Only checked-in appointments can be completed.'], 409);
        }
        $pdo->prepare("UPDATE appointments SET status = 'Completed' WHERE id = ?")->execute([$appointmentId]);
        notify($pdo, 'coordinator', null, 'Consultation Completed',
            "The consultation for {$app['reference_code']} has been completed. Follow-up advice may now be recorded.");
        if (!empty($app['patient_id'])) {
            notify($pdo, 'patient', (int)$app['patient_id'], 'Consultation Completed',
                "Your consultation ({$app['reference_code']}) has been marked completed.");
        }
        log_activity($pdo, $appointmentId, 'consultation_completed', 'Consultation marked completed.');
        json_out(['success' => true, 'message' => 'Consultation marked as completed.']);
    }

    if ($action === 'followup') {
        if ($app['status'] !== 'Completed') {
            json_out(['success' => false, 'message' => 'Follow-up advice can only be added after the consultation is completed.'], 409);
        }
        if ($period === '') {
            json_out(['success' => false, 'message' => 'Please provide a follow-up timeframe.'], 422);
        }
        $pdo->prepare("UPDATE appointments SET followup_timeframe = ?, followup_notes = ? WHERE id = ?")
            ->execute([$period, $notes !== '' ? $notes : null, $appointmentId]);
        notify($pdo, 'coordinator', null, 'Follow-up Advice',
            "The doctor added follow-up advice for {$app['reference_code']}. Please arrange the follow-up schedule if needed.");
        if (!empty($app['patient_id'])) {
            $patientMsg = "Your doctor added follow-up advice for {$app['reference_code']}: {$period}";
            if ($notes !== '') $patientMsg .= " — {$notes}";
            notify($pdo, 'patient', (int)$app['patient_id'], 'New Follow-up Advice', $patientMsg);
        }
        log_activity($pdo, $appointmentId, 'followup_advice', $period . ($notes !== '' ? ' — ' . $notes : ''));
        json_out(['success' => true, 'message' => 'Follow-up advice saved and sent to the patient.']);
    }

    json_out(['success' => false, 'message' => 'Invalid action.'], 422);
} catch (Throwable $e) {
    fail($e);
}
