<?php
require_once __DIR__ . '/../db.php';
require_login(['coordinator']);
try {
  $rows = $pdo->query("SELECT l.*, u.full_name FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 150")->fetchAll();
  json_out(['success'=>true,'logs'=>$rows]);
} catch (Throwable $e) { fail($e); }
