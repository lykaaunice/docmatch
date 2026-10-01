<?php
require_once __DIR__ . '/../db.php';
require_login(['coordinator', 'doctor']);

$d = json_input();
$action = $d['action'] ?? '';

function coordinator_only() {
    if ($_SESSION['role'] !== 'coordinator') {
        json_out(['success' => false, 'message' => 'Only the Coordinator can perform this action.'], 403);
    }
}

function valid_range($start, $end) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) return 'Invalid date.';
    if ($start < date('Y-m-d') || $end < $start) return 'The start date cannot be in the past, and the end date cannot be earlier than the start.';
    if ((strtotime($end) - strtotime($start)) / 86400 > 60) return 'Maximum of 60 days.';
    return null;
}

try {
    // Schedule and clinic-level actions
    if ($action === 'leave_decision') {                       // Rule #12: planned leave = the coordinator decides
        coordinator_only();
        $leaveId  = (int)($d['leave_id'] ?? 0);
        $decision = $d['decision'] ?? '';
        if (!$leaveId || !in_array($decision, ['approve', 'reject'], true)) {
            json_out(['success' => false, 'message' => 'Invalid parameters.'], 422);
        }
        $s = $pdo->prepare("SELECT * FROM doctor_leaves WHERE id = ? AND status = 'Pending'");
        $s->execute([$leaveId]);
        $leave = $s->fetch();
        if (!$leave) json_out(['success' => false, 'message' => 'This request is no longer pending.'], 404);

        $affected = 0;
        $pdo->beginTransaction();
        if ($decision === 'approve') {
            $pdo->prepare("UPDATE doctor_leaves SET status = 'Approved' WHERE id = ?")->execute([$leaveId]);
            $affected = apply_leave_block($pdo, (int)$leave['doctor_id'], $leave['start_date'], $leave['end_date'],
                                          $leave['reason'] ?: 'Planned leave', 'planned');
            notify_doctor($pdo, (int)$leave['doctor_id'], 'Leave Approved',
                "Your leave ({$leave['start_date']} to {$leave['end_date']}) has been approved.");
        } else {
            $pdo->prepare("UPDATE doctor_leaves SET status = 'Rejected' WHERE id = ?")->execute([$leaveId]);
            notify_doctor($pdo, (int)$leave['doctor_id'], 'Leave Rejected',
                "Your leave request ({$leave['start_date']} to {$leave['end_date']}) was not approved.");
        }
        $pdo->commit();
        json_out(['success' => true, 'affected_appointments' => $affected]);
    }

    if ($action === 'set_workdays') {                         // Rule #10: the coordinator plans the schedule
        coordinator_only();
        $docId = (int)($d['doctor_id'] ?? 0);
        $days = array_values(array_unique(array_map('intval', (array)($d['days'] ?? []))));
        $days = array_values(array_filter($days, fn($n) => $n >= 1 && $n <= 7));
        sort($days);
        if (!$docId || !$days) json_out(['success' => false, 'message' => 'Select at least one workday.'], 422);

        $names = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
        $csv = implode(',', array_map(fn($n) => $names[$n], $days));

        $pdo->beginTransaction();
        $pdo->prepare("UPDATE doctors SET available_days = ? WHERE id = ?")->execute([$csv, $docId]);

        // Existing bookings on a removed workday need reassignment.
        $s = $pdo->prepare("SELECT id, appointment_date FROM appointments
            WHERE doctor_id = ? AND appointment_date >= ? AND status IN ('Pending','Booked','Proposed')");
        $s->execute([$docId, date('Y-m-d')]);
        $ids = [];
        foreach ($s->fetchAll() as $row) {
            if (!in_array((int)date('N', strtotime($row['appointment_date'])), $days, true)) $ids[] = (int)$row['id'];
        }
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("UPDATE appointments SET status = 'Needs_Reassignment', forwarded_to_doctor = 0,
                decline_reason = 'Doctor workdays changed' WHERE id IN ($in)")->execute($ids);
        }
        notify_doctor($pdo, $docId, 'Your Schedule Changed', "New workdays: $csv.");
        notify($pdo, 'coordinator', null, 'Doctor Schedule Changed',
            "Workdays: $csv. " . count($ids) . ' appointment(s) need to be reassigned.');
        $pdo->commit();
        json_out(['success' => true, 'affected_appointments' => count($ids)]);
    }

    if ($action === 'add_commitment') {                       // other doctor commitments (even mid-month)
        coordinator_only();
        $docId = (int)($d['doctor_id'] ?? 0);
        $start = trim($d['start_date'] ?? '');
        $end = trim($d['end_date'] ?? '') ?: $start;
        $reason = trim($d['reason'] ?? '') ?: 'Commitment';
        $err = valid_range($start, $end);
        if (!$docId) $err = 'Select a doctor.';
        if ($err) json_out(['success' => false, 'message' => $err], 422);

        $pdo->beginTransaction();
        $affected = apply_leave_block($pdo, $docId, $start, $end, $reason, 'commitment');
        notify_doctor($pdo, $docId, 'New Schedule Commitment', "$start to $end: $reason");
        notify($pdo, 'coordinator', null, 'Doctor Schedule Changed',
            "Commitment $start to $end. $affected appointment(s) need to be reassigned.");
        $pdo->commit();
        json_out(['success' => true, 'affected_appointments' => $affected]);
    }

    if ($action === 'remove_blockout') {
        coordinator_only();
        $bid = (int)($d['blockout_id'] ?? 0);
        $s = $pdo->prepare("SELECT * FROM doctor_blockouts WHERE id = ?");
        $s->execute([$bid]);
        $bo = $s->fetch();
        if (!$bo) json_out(['success' => false, 'message' => 'Blockout not found.'], 404);
        $pdo->prepare("DELETE FROM doctor_blockouts WHERE id = ?")->execute([$bid]);
        notify_doctor($pdo, (int)$bo['doctor_id'], 'Your Schedule Changed', "{$bo['block_date']} has been reopened.");
        notify($pdo, 'coordinator', null, 'Doctor Schedule Changed', "{$bo['block_date']} has been reopened.");
        json_out(['success' => true]);
    }

    // Appointment actions
    $id = (int)($d['appointment_id'] ?? 0);
    if (!$id) json_out(['success' => false, 'message' => 'Missing appointment ID.'], 422);

    $s = $pdo->prepare("SELECT * FROM appointments WHERE id = ?");
    $s->execute([$id]);
    $app = $s->fetch();
    if (!$app) json_out(['success' => false, 'message' => 'Appointment not found.'], 404);

    // Fall back to the assigned doctor specialty for older records.
    $appSpec = $app['specialty_id'];
    if (!$appSpec) {
        $q = $pdo->prepare("SELECT specialty_id FROM doctors WHERE id = ?");
        $q->execute([$app['doctor_id']]);
        $appSpec = $q->fetchColumn();
    }

    // Forward an appointment to the selected doctor.
    if ($action === 'forward') {
        coordinator_only();
        if ($app['status'] !== 'Pending') {
            json_out(['success' => false, 'message' => 'Only Pending appointments can be forwarded to the doctor.'], 409);
        }
        $note = trim($d['note'] ?? '');
        $pdo->prepare("UPDATE appointments SET forwarded_to_doctor = 1, coordinator_note = ? WHERE id = ?")
            ->execute([$note !== '' ? $note : null, $id]);
        notify_doctor($pdo, (int)$app['doctor_id'], 'New Appointment for Review',
            "{$app['patient_name']} - {$app['appointment_date']} ({$app['reference_code']})" . ($note !== '' ? ". Note: $note" : ''));
        // The patient is notified after the coordinator completes this step.
        $lg = $pdo->prepare("SELECT username FROM users WHERE role = 'doctor' AND doctor_id = ?");
        $lg->execute([$app['doctor_id']]);
        log_activity($pdo, $id, 'forwarded_to_doctor', $note);
        json_out(['success' => true, 'message' => 'Forwarded to the doctor for review.',
                  'doctor_logins' => $lg->fetchAll(PDO::FETCH_COLUMN)]);

    // Send the doctor decision to the patient.
    // Check in the patient on arrival.
    } elseif ($action === 'checkin') {
        coordinator_only();
        if ($app['status'] !== 'Booked') json_out(['success' => false, 'message' => 'Only Booked appointments can be checked in.'], 409);
        $pdo->prepare("UPDATE appointments SET status = 'Checked_In' WHERE id = ?")->execute([$id]);
        notify_doctor($pdo, (int)$app['doctor_id'], 'Patient Has Arrived',
            "{$app['patient_name']} ({$app['reference_code']}) has been checked in and is ready for consultation.");
        log_activity($pdo, $id, 'patient_checked_in', 'Patient checked in.');
        json_out(['success' => true, 'message' => 'Checked in; the doctor has been notified.']);

    } elseif ($action === 'notify_patient') {
        coordinator_only();
        if (!in_array($app['status'], ['Booked', 'Proposed'], true) || !$app['patient_id']) {
            json_out(['success' => false, 'message' => 'Nothing is ready to send to the patient.'], 409);
        }
        $when = "{$app['appointment_date']} " . substr($app['appointment_time'], 0, 5);
        $pdo->prepare("UPDATE appointments SET patient_notified = 1 WHERE id = ?")->execute([$id]);

        if ($app['status'] === 'Proposed') { // Send the follow-up proposal to the patient and doctor
            if ($app['parent_id']) $pdo->prepare("UPDATE appointments SET followup_relayed = 1 WHERE id = ?")->execute([$app['parent_id']]);
            notify($pdo, 'patient', (int)$app['patient_id'], 'Follow-up Proposal',
                "A follow-up has been proposed: $when ({$app['reference_code']}). Please confirm or decline it under your Appointments.");
            notify_doctor($pdo, (int)$app['doctor_id'], 'Follow-up Proposed',
                "{$app['patient_name']} - $when ({$app['reference_code']}). Awaiting confirmation from the patient.");
            json_out(['success' => true, 'message' => 'Follow-up schedule sent to the patient.']);
        }
        // Notify the patient when the appointment is accepted.
        notify($pdo, 'patient', (int)$app['patient_id'], 'Appointment Confirmed',
            "{$app['reference_code']} on $when is confirmed.");
        log_activity($pdo, $id, 'patient_notified', 'Coordinator notified the patient.');
        json_out(['success' => true, 'message' => 'Appointment confirmation sent to the patient.']);

    // Reassign to another doctor in the same specialty.
    } elseif ($action === 'reassign') {
        coordinator_only();
        $newDoc = (int)($d['new_doctor_id'] ?? 0);
        $date = $d['new_date'] ?? '';
        $time = $d['new_time'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) {
            json_out(['success' => false, 'message' => 'Invalid date.'], 422);
        }
        $q = $pdo->prepare("SELECT specialty_id FROM doctors WHERE id = ? AND status = 'Active'");
        $q->execute([$newDoc]);
        $newSpec = $q->fetchColumn();
        if (!$newSpec) json_out(['success' => false, 'message' => 'No doctor found with that ID.'], 404);
        if ($appSpec && (int)$newSpec !== (int)$appSpec) {
            json_out(['success' => false, 'message' => 'You can only reassign to a doctor with the same specialty.'], 422);
        }
        $problem = slot_problem($pdo, $newDoc, $date, $time, $id);
        if ($problem) json_out(['success' => false, 'message' => $problem], 409);

        // The newly assigned doctor reviews the appointment again.
        $pdo->prepare("UPDATE appointments SET doctor_id = ?, specialty_id = ?, appointment_date = ?, appointment_time = ?,
                       status = 'Pending', forwarded_to_doctor = 1, patient_notified = 0, decline_reason = NULL WHERE id = ?")
            ->execute([$newDoc, $newSpec, $date, $time, $id]);
        notify_doctor($pdo, $newDoc, 'Appointment Reassigned',
            "{$app['patient_name']} - $date $time ({$app['reference_code']}). Please review.");
        json_out(['success' => true, 'message' => 'Reassigned to the new doctor. Awaiting the doctor decision.']);

    // Record doctor follow-up advice for the care workflow.
    } elseif ($action === 'save_followup') {
        if ($_SESSION['role'] === 'doctor' && (int)$app['doctor_id'] !== (int)$_SESSION['doctor_id']) {
            json_out(['success' => false, 'message' => 'This is not your appointment.'], 403);
        }
        if ($app['status'] !== 'Completed') {
            json_out(['success' => false, 'message' => 'Follow-up advice can only be added after the consultation (Completed).'], 409);
        }
        $tf = trim($d['timeframe'] ?? '');
        $notes = trim($d['notes'] ?? '');
        if ($tf === '') json_out(['success' => false, 'message' => 'Enter the follow-up timeframe.'], 422);
        $pdo->prepare("UPDATE appointments SET followup_timeframe = ?, followup_notes = ?, followup_relayed = 0 WHERE id = ?")
            ->execute([$tf, $notes, $id]);
        notify($pdo, 'coordinator', null, 'Follow-up Advice',
            "{$app['patient_name']} ({$app['reference_code']}): $tf" . ($notes !== '' ? " — $notes" : '') . '. Please schedule a follow-up.');
        json_out(['success' => true, 'message' => 'Follow-up advice sent to the Coordinator.']);

    // Coordinator proposes a follow-up schedule for patient confirmation.
    } elseif ($action === 'schedule_followup') {
        coordinator_only();
        if (!$app['followup_timeframe']) json_out(['success' => false, 'message' => 'The doctor has not given follow-up advice.'], 409);
        $newDoc = (int)($d['doctor_id'] ?? 0);
        $date = $d['new_date'] ?? '';
        $time = $d['new_time'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) {
            json_out(['success' => false, 'message' => 'Invalid date.'], 422);
        }
        $q = $pdo->prepare("SELECT specialty_id, name FROM doctors WHERE id = ? AND status = 'Active'");
        $q->execute([$newDoc]);
        $nd = $q->fetch();
        if (!$nd) json_out(['success' => false, 'message' => 'Doctor not found.'], 404);
        if ($appSpec && (int)$nd['specialty_id'] !== (int)$appSpec) {
            json_out(['success' => false, 'message' => 'Only doctors with the same specialty are allowed.'], 422);
        }
        $problem = slot_problem($pdo, $newDoc, $date, $time);
        if ($problem) json_out(['success' => false, 'message' => $problem], 409);

        // Registered patients receive a proposed slot and confirm it before booking.
        // Walk-ins can be booked directly because confirmation happens in person.
        $toPatient = !empty($app['patient_id']);
        $pdo->beginTransaction();
        $ref = new_reference($pdo);
        $pdo->prepare("INSERT INTO appointments
            (reference_code, patient_id, patient_name, contact_number, specialty_id, doctor_id, appointment_date, appointment_time,
             status, booked_by_role, forwarded_to_doctor, patient_notified, parent_id)
            VALUES (?,?,?,?,?,?,?,?, ?, 'coordinator', ?, ?, ?)")
            ->execute([$ref, $app['patient_id'], $app['patient_name'], $app['contact_number'], $nd['specialty_id'],
                       $newDoc, $date, $time, $toPatient ? 'Proposed' : 'Booked', $toPatient ? 0 : 1, $toPatient ? 0 : 1, $id]);
        // 2 = follow-up schedule proposed but not yet sent for confirmation.
        $pdo->prepare("UPDATE appointments SET followup_relayed = ? WHERE id = ?")->execute([$toPatient ? 2 : 1, $id]);
        if (!$toPatient) notify_doctor($pdo, $newDoc, 'Follow-up Scheduled', "{$app['patient_name']} - $date $time ($ref)");
        $pdo->commit();
        json_out(['success' => true, 'reference_code' => $ref,
                  'message' => $toPatient ? 'Proposed. Send it to the patient so they can confirm.' : 'Walk-in follow-up scheduled.']);
    }
    json_out(['success' => false, 'message' => 'Invalid action.'], 422);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fail($e);
}
