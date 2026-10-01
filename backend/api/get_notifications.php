<?php
require_once __DIR__ . '/../db.php';
require_login();

try {
    $role = $_SESSION['role'];
    if (($_GET['mark_read'] ?? '') === '1') {
        $pdo->prepare("UPDATE notifications SET is_read = 1
            WHERE target_role IN (?, 'all') AND (target_user_id IS NULL OR target_user_id = ?)")
            ->execute([$role, $_SESSION['user_id']]);
    }
    $s = $pdo->prepare("SELECT * FROM notifications
                        WHERE (target_role = ? OR target_role = 'all')
                          AND (target_user_id IS NULL OR target_user_id = ?)
                        ORDER BY created_at DESC, id DESC LIMIT 20");
    $s->execute([$role, $_SESSION['user_id']]);
    $notifs = $s->fetchAll();
    $unread = count(array_filter($notifs, fn($n) => (int)$n['is_read'] === 0));
    json_out(['success' => true, 'notifications' => $notifs, 'unread_count' => $unread]);
} catch (Throwable $e) {
    fail($e);
}
