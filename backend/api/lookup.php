<?php
require_once __DIR__ . '/../db.php';

$ref = trim($_GET['ref'] ?? '');
$contact = trim($_GET['contact'] ?? '');
if ($ref === '' || $contact === '') {
    json_out(['success' => false, 'message' => 'Provide the Reference Code and Contact Number.'], 422);
}
try {
    $wait = rate_limit_wait($pdo, 'lookup', '-', 10, 15);
    if ($wait > 0) json_out(['success' => false, 'message' => 'Too many lookups. Please try again later.'], 429);
    $s = $pdo->prepare("SELECT a.*, d.name AS doctor_name, d.room_number, s.name AS specialty_name
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN specialties s ON a.specialty_id = s.id
        WHERE a.reference_code = ? AND a.contact_number = ?");
    $s->execute([$ref, $contact]);
    $row = $s->fetch();
    if ($row) json_out(['success' => true, 'appointment' => $row]);
    rate_limit_hit($pdo, 'lookup', '-');
    json_out(['success' => false, 'message' => 'No appointment found for the details provided.'], 404);
} catch (Throwable $e) {
    fail($e);
}
