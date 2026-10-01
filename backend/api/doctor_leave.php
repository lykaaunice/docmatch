<?php
// Emergency leave blocks the schedule immediately; planned leave requires approval.
require_once __DIR__ . '/../db.php';
require_login(['doctor']);

$d = json_input();
$doctorId = (int)($_SESSION['doctor_id'] ?? 0);
$type  = (($d['leave_type'] ?? '') === 'Planned') ? 'Planned' : 'Emergency';
$start = trim($d['start_date'] ?? '');
$end   = trim($d['end_date'] ?? '') ?: $start;
$reason = trim($d['reason'] ?? '') ?: ($type === 'Emergency' ? 'Emergency leave' : 'Planned leave');

if (!$doctorId) {
    json_out(['success' => false, 'message' => 'No doctor is linked to your account.'], 422);
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    json_out(['success' => false, 'message' => 'Invalid date.'], 422);
}
if ($start < date('Y-m-d') || $end < $start) {
    json_out(['success' => false, 'message' => 'The start date cannot be in the past, and the end date cannot be earlier than the start.'], 422);
}
if ((strtotime($end) - strtotime($start)) / 86400 > 60) {
    json_out(['success' => false, 'message' => 'A leave can be at most 60 days.'], 422);
}

try {
    $pdo->beginTransaction();
    if ($type === 'Emergency') {
        $pdo->prepare("INSERT INTO doctor_leaves (doctor_id, leave_type, start_date, end_date, reason, status) VALUES (?, 'Emergency', ?, ?, ?, 'Approved')")
            ->execute([$doctorId, $start, $end, $reason]);
        $affected = apply_leave_block($pdo, $doctorId, $start, $end, $reason, 'emergency');
        notify($pdo, 'coordinator', null, 'Emergency Leave',
            "$affected appointment(s) need to be reassigned ($start to $end).");
        $pdo->commit();
        json_out(['success' => true, 'type' => 'Emergency', 'affected_appointments' => $affected]);
    }

    $pdo->prepare("INSERT INTO doctor_leaves (doctor_id, leave_type, start_date, end_date, reason, status) VALUES (?, 'Planned', ?, ?, ?, 'Pending')")
        ->execute([$doctorId, $start, $end, $reason]);
    notify($pdo, 'coordinator', null, 'Leave Request',
        "A doctor submitted a leave request for $start to $end. Reason: $reason");
    $pdo->commit();
    json_out(['success' => true, 'type' => 'Planned']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail($e);
}
