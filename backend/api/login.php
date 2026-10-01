<?php
require_once __DIR__ . '/../db.php';

try {
    $d = json_input();
    $username = trim((string)($d['username'] ?? ''));
    $password = (string)($d['password'] ?? '');

    if ($username === '' || $password === '' || strlen($username) > 50 || strlen($password) > 200) {
        json_out(['success' => false, 'message' => 'Enter your username and password.'], 422);
    }

    // Apply a short lockout after repeated failed login attempts.
    $key  = strtolower($username);
    $wait = rate_limit_wait($pdo, 'login', $key, 5, 15);
    if ($wait > 0) {
        header('Retry-After: ' . $wait);
        json_out(['success' => false, 'message' => 'Too many failed attempts. Try again in ' . ceil($wait / 60) . ' minute(s).'], 429);
    }

    $s = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $s->execute([$username]);
    $u = $s->fetch();

    // Keep failed-login timing similar for existing and unknown usernames.
    if ($u) {
        $ok = password_verify($password, $u['password']);
    } else {
        password_hash($password, PASSWORD_DEFAULT);
        $ok = false;
    }

    if (!$ok) {
        rate_limit_hit($pdo, 'login', $key);
        json_out(['success' => false, 'message' => 'Incorrect username or password.'], 401);
    }

    rate_limit_clear($pdo, 'login', $key);
    if (password_needs_rehash($u['password'], PASSWORD_DEFAULT)) {
        $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")
            ->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
    }

    session_regenerate_id(true);
    $_SESSION['csrf']      = bin2hex(random_bytes(32));   // fresh token for the new session
    $_SESSION['user_id']   = $u['id'];
    $_SESSION['username']  = $u['username'];
    $_SESSION['full_name'] = $u['full_name'];
    $_SESSION['role']      = $u['role'];
    $_SESSION['doctor_id'] = $u['doctor_id'];

    json_out(['success' => true, 'csrf' => $_SESSION['csrf'], 'user' => [
        'id' => $u['id'], 'full_name' => $u['full_name'], 'role' => $u['role'], 'doctor_id' => $u['doctor_id']
    ]]);
} catch (Throwable $e) {
    fail($e);
}
