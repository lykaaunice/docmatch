<?php
// Public registration creates patient accounts only.
require_once __DIR__ . '/../db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(['success' => false, 'message' => 'Invalid request.'], 405);
}

try {
    $d        = json_input();
    $username = trim((string)($d['username'] ?? ''));
    $password = (string)($d['password'] ?? '');
    $fullName = trim(preg_replace('/\s+/', ' ', (string)($d['full_name'] ?? '')));
    $contact  = trim((string)($d['contact_number'] ?? ''));

    // Basic signup rate limit per IP.
    $wait = rate_limit_wait($pdo, 'register', '-', 5, 60);
    if ($wait > 0) {
        header('Retry-After: ' . $wait);
        json_out(['success' => false, 'message' => 'Too many sign-ups from this device. Please try again later.'], 429);
    }

    if (!preg_match('/^[A-Za-z0-9_.]{3,30}$/', $username)) {
        json_out(['success' => false, 'message' => 'Username must be 3-30 characters: letters, numbers, dot or underscore.'], 422);
    }
    if (preg_match('/^(dr_|doctor|coordinator|nurse|admin|staff)/i', $username)) {
        json_out(['success' => false, 'message' => 'That username is reserved. Please choose another.'], 422);
    }
    if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 100) {
        json_out(['success' => false, 'message' => 'Enter your full name.'], 422);
    }
    if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $contact)) {
        json_out(['success' => false, 'message' => 'Enter a valid contact number (e.g. 09123456789).'], 422);
    }
    if (strlen($password) < 8 || strlen($password) > 72) {
        json_out(['success' => false, 'message' => 'Password must be 8-72 characters.'], 422);
    }
    if (strcasecmp($password, $username) === 0) {
        json_out(['success' => false, 'message' => 'Password must not be the same as your username.'], 422);
    }

    rate_limit_hit($pdo, 'register', '-');

    try {
        $pdo->prepare("INSERT INTO users (username, password, full_name, role, contact_number) VALUES (?,?,?,'patient',?)")
            ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $contact]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_out(['success' => false, 'message' => 'That username is already taken.'], 409);
        }
        throw $e;
    }

    json_out(['success' => true, 'message' => 'Account created. You can log in now.', 'username' => $username]);
} catch (Throwable $e) {
    fail($e);
}
