<?php
// Return booked times and doctor availability for the selected date.
require_once __DIR__ . '/../db.php';
require_login();

$doctor_id = (int)($_GET['doctor_id'] ?? 0);
$date = $_GET['date'] ?? '';
if (!$doctor_id || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_out(['success' => true, 'taken' => [], 'blocked' => false]);
}
try {
    $s = $pdo->prepare("SELECT appointment_time FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled','Needs_Reassignment')");
    $s->execute([$doctor_id, $date]);
    $taken = $s->fetchAll(PDO::FETCH_COLUMN);

    $b = $pdo->prepare("SELECT COUNT(*) FROM doctor_blockouts WHERE doctor_id = ? AND block_date = ?");
    $b->execute([$doctor_id, $date]);
    $blocked = $b->fetchColumn() > 0;

    $d = $pdo->prepare("SELECT available_days FROM doctors WHERE id = ?");
    $d->execute([$doctor_id]);
    $days = $d->fetchColumn();
    if ($days !== false && !in_array((int)date('N', strtotime($date)), doctor_workdays($days), true)) $blocked = true;

    json_out(['success' => true, 'taken' => $taken, 'blocked' => $blocked]);
} catch (Throwable $e) {
    fail($e);
}
