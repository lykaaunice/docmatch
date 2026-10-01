<?php
// Return open doctor slots for the selected week.
require_once __DIR__ . '/../db.php';
require_login(['coordinator']);

$doctorId = (int)($_GET['doctor_id'] ?? 0);
$weekOf = $_GET['week_of'] ?? '';
if (!$doctorId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekOf)) {
    json_out(['success' => false, 'message' => 'Select a doctor and a week.'], 422);
}
try {
    $monday = strtotime('monday this week', strtotime($weekOf));
    $today = date('Y-m-d');
    $slots = [];
    for ($i = 0; $i < 7; $i++) {
        $ts = strtotime("+$i day", $monday);
        $date = date('Y-m-d', $ts);
        if ($date < $today) continue;
        foreach (clinic_slots() as $t) {
            if (slot_problem($pdo, $doctorId, $date, $t) === null) {
                $slots[] = ['date' => $date, 'time' => $t, 'label' => date('D, M j', $ts) . ' · ' . date('h:i A', strtotime($t))];
            }
        }
    }
    json_out(['success' => true, 'slots' => $slots]);
} catch (Throwable $e) {
    fail($e);
}
