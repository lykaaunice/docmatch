<?php
require_once __DIR__ . '/../db.php';
require_login();

try {
    $sql = "SELECT a.*, d.name AS doctor_name, s.name AS specialty_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN specialties s ON a.specialty_id = s.id";
    $params = [];

    // Scope appointment data to the signed-in role.
    if ($_SESSION['role'] === 'patient') {
        $sql .= " WHERE a.patient_id = ? AND NOT (a.status = 'Proposed' AND a.patient_notified = 0)";
        $params[] = $_SESSION['user_id'];
    } elseif ($_SESSION['role'] === 'doctor') {
        $sql .= " WHERE a.doctor_id = ? AND (a.forwarded_to_doctor = 1 OR a.status <> 'Pending') AND NOT (a.status = 'Proposed' AND a.patient_notified = 0)";
        $params[] = $_SESSION['doctor_id'];
    }
    $sql .= " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    $s = $pdo->prepare($sql);
    $s->execute($params);
    $rows = $s->fetchAll();

    if ($_SESSION['role'] === 'patient') {
        foreach ($rows as &$r) {
            // Keep workflow progress visible to the patient throughout review.
            $patientNotified = (int)$r['patient_notified'] === 1 || $r['booked_by_role'] !== 'patient';
            $r['doctor_accepted'] = ($r['status'] === 'Booked' && !$patientNotified) ? 1 : 0;
            if ($r['status'] === 'Needs_Reassignment' || ($r['status'] === 'Booked' && !$patientNotified)) $r['status'] = 'Pending';
            // Keep the doctor-review stage visible in the patient tracker.
            $r['decline_reason'] = null;
            $r['coordinator_note'] = null;
            // Follow-up advice is available to the patient as soon as the doctor saves it.
            // followup_relayed tracks the separate follow-up scheduling step.
        }
        unset($r);
    }
    json_out(['success' => true, 'appointments' => $rows]);
} catch (Throwable $e) {
    fail($e);
}
