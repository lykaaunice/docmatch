<?php
require_once __DIR__ . '/../db.php';
require_login(['coordinator', 'doctor']);

try {
    $sql = "SELECT l.*, d.name AS doctor_name FROM doctor_leaves l JOIN doctors d ON l.doctor_id = d.id";
    $params = [];
    if ($_SESSION['role'] === 'doctor') {
        $sql .= " WHERE l.doctor_id = ?";
        $params[] = $_SESSION['doctor_id'];
    }
    $sql .= " ORDER BY FIELD(l.status,'Pending','Approved','Rejected'), l.start_date DESC LIMIT 50";
    $s = $pdo->prepare($sql);
    $s->execute($params);
    json_out(['success' => true, 'leaves' => $s->fetchAll()]);
} catch (Throwable $e) {
    fail($e);
}
