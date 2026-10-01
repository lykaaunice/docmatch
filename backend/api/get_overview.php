<?php
require_once __DIR__ . '/../db.php';

try {
    $specialties = $pdo->query("SELECT * FROM specialties ORDER BY name")->fetchAll();
    $doctors = $pdo->query("SELECT d.*, s.name AS specialty_name
        FROM doctors d JOIN specialties s ON d.specialty_id = s.id
        WHERE d.status = 'Active' ORDER BY d.name")->fetchAll();
    json_out(['success' => true, 'specialties' => $specialties, 'doctors' => $doctors]);
} catch (Throwable $e) {
    fail($e);
}
