<?php
// Public queue board; no patient-identifying details are returned.
require_once __DIR__ . '/../db.php';

try {
    $today = date('Y-m-d');
    $s = $pdo->prepare("
        SELECT d.id, d.name, d.room_number, d.available_days, sp.name AS specialty_name,
          (SELECT COUNT(*) FROM doctor_blockouts b WHERE b.doctor_id = d.id AND b.block_date = :t1) AS is_blocked,
          (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.appointment_date = :t2 AND a.status = 'Booked') AS booked_count
        FROM doctors d JOIN specialties sp ON d.specialty_id = sp.id
        WHERE d.status = 'Active'
        ORDER BY sp.name, d.name");
    $s->execute([':t1' => $today, ':t2' => $today]);

    $out = [];
    foreach ($s->fetchAll() as $r) {
        $blocked = $r['is_blocked'] > 0;
        $out[] = [
            'id' => $r['id'], 'name' => $r['name'], 'room' => $r['room_number'],
            'specialty' => $r['specialty_name'], 'days' => $r['available_days'],
            'booked_slots' => (int)$r['booked_count'],
            'status' => $blocked ? 'UNAVAILABLE' : 'AVAILABLE',
            'status_color' => $blocked ? 'red' : 'emerald',
        ];
    }
    json_out(['success' => true, 'date' => $today, 'doctors' => $out]);
} catch (Throwable $e) {
    fail($e);
}
