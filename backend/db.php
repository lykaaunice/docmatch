<?php

// Database connection and shared backend helpers.

$hostName = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? 'localhost')[0]);

if (in_array($hostName, ['localhost', '127.0.0.1'], true)) {
    // Local XAMPP database
    $host = '127.0.0.1';
    $db   = 'docmatch_db';
    $user = 'root';
    $pass = '';
} else {
    // Live InfinityFree database
    $config = require __DIR__ . '/db_config.php';

    $host = $config['host'];
    $db   = $config['db'];
    $user = $config['user'];
    $pass = $config['pass'];
}

date_default_timezone_set('Asia/Manila');

// Log server errors instead of exposing internal details to the browser.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS'])]);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function json_out($arr, $code = 200) {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_input() {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}

// Require an authenticated user with the expected role.
function require_login(array $roles = []) {
    if (empty($_SESSION['user_id'])) {
        json_out(['success' => false, 'message' => 'Session expired. Please log in again.'], 401);
    }
    if ($roles && !in_array($_SESSION['role'], $roles, true)) {
        json_out(['success' => false, 'message' => 'You are not allowed to perform this action.'], 403);
    }
}

// Log internal errors and return safe messages to the browser.
function fail(Throwable $e, int $code = 500) {
    global $pdo;
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    $msg = $e->getMessage();
    if ($e instanceof PDOException) {
        if (strpos($msg, 'uq_active_slot') !== false) {
            json_out(['success' => false, 'message' => 'That time slot was just taken by someone else. Please choose another time.'], 409);
        }
        if (in_array((string)$e->getCode(), ['40001', '1213', '1205'], true)) {   // deadlock / lock timeout
            json_out(['success' => false, 'message' => 'The system is busy. Please try again.'], 409);
        }
    }
    error_log('[DocMatch] ' . get_class($e) . ': ' . $msg . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    json_out(['success' => false, 'message' => 'Something went wrong on the server. Please try again.'], $code);
}

// CSRF protection
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
// Non-GET requests must include the current CSRF token.
function csrf_enforce() {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') return;
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) {
        json_out(['success' => false, 'message' => 'Security check failed. Please refresh the page and try again.'], 403);
    }
}
csrf_enforce();

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    error_log('[DocMatch] DB connection failed: ' . $e->getMessage());
    json_out(['success' => false, 'message' => 'Cannot connect to the database. Is MySQL running?'], 500);
}

// Create missing tables without replacing existing data.
// Seed demo records only when the related tables are new.
function ensure_schema(PDO $pdo) {
    $exists = function ($t) use ($pdo) {
        $s = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $s->execute([$t]);
        return $s->fetchColumn() > 0;
    };

    $defs = [
        'specialties' => "CREATE TABLE specialties (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) DEFAULT NULL)",
        'doctors' => "CREATE TABLE doctors (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            specialty_id INT NOT NULL,
            room_number VARCHAR(20) DEFAULT NULL,
            available_days VARCHAR(100) DEFAULT 'Mon-Fri',
            status VARCHAR(20) NOT NULL DEFAULT 'Active')",
        'users' => "CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL,
            doctor_id INT DEFAULT NULL,
            contact_number VARCHAR(20) DEFAULT NULL)",
        'appointments' => "CREATE TABLE appointments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reference_code VARCHAR(20) DEFAULT NULL,
            patient_id INT DEFAULT NULL,
            patient_name VARCHAR(100) NOT NULL DEFAULT '',
            contact_number VARCHAR(20) DEFAULT NULL,
            specialty_id INT DEFAULT NULL,
            doctor_id INT NOT NULL,
            appointment_date DATE NOT NULL,
            appointment_time TIME NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'Pending',
            booked_by_role VARCHAR(20) DEFAULT 'patient',
            decline_reason VARCHAR(255) DEFAULT NULL,
            followup_timeframe VARCHAR(100) DEFAULT NULL,
            followup_notes TEXT DEFAULT NULL,
            forwarded_to_doctor TINYINT(1) NOT NULL DEFAULT 0,
            coordinator_note TEXT DEFAULT NULL,
            cancel_reason VARCHAR(255) DEFAULT NULL,
            patient_notified TINYINT(1) NOT NULL DEFAULT 0,
            followup_relayed TINYINT(1) NOT NULL DEFAULT 0,
            parent_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_slot (doctor_id, appointment_date, appointment_time))",
        'doctor_blockouts' => "CREATE TABLE doctor_blockouts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            doctor_id INT NOT NULL,
            block_date DATE NOT NULL,
            type VARCHAR(30) DEFAULT 'emergency',
            reason VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        'doctor_leaves' => "CREATE TABLE doctor_leaves (
            id INT AUTO_INCREMENT PRIMARY KEY,
            doctor_id INT NOT NULL,
            leave_type VARCHAR(20) NOT NULL DEFAULT 'Planned',
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            reason VARCHAR(255) DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        'login_attempts' => "CREATE TABLE login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(45) NOT NULL,
            username VARCHAR(50) DEFAULT NULL,
            kind VARCHAR(10) NOT NULL DEFAULT 'login',
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip (ip, kind, attempted_at),
            INDEX idx_user (username, kind, attempted_at))",
        'notifications' => "CREATE TABLE notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            target_role VARCHAR(20) NOT NULL,
            target_user_id INT DEFAULT NULL,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        'messages' => "CREATE TABLE messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            appointment_id INT NOT NULL,
            sender_user_id INT NOT NULL,
            receiver_user_id INT NOT NULL,
            message TEXT NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_appointment (appointment_id, created_at),
            INDEX idx_msg_receiver (receiver_user_id, is_read))",
        'activity_logs' => "CREATE TABLE activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            appointment_id INT DEFAULT NULL,
            user_id INT DEFAULT NULL,
            role VARCHAR(20) DEFAULT NULL,
            action VARCHAR(80) NOT NULL,
            details VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_activity_appointment (appointment_id, created_at),
            INDEX idx_activity_user (user_id, created_at))",
        'appointment_reschedule_history' => "CREATE TABLE appointment_reschedule_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            appointment_id INT NOT NULL,
            old_date DATE NOT NULL,
            old_time TIME NOT NULL,
            new_date DATE NOT NULL,
            new_time TIME NOT NULL,
            changed_by_user_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_reschedule_appointment (appointment_id, created_at))",
    ];

    $demoHash = password_hash('123456', PASSWORD_DEFAULT);   // demo accounts are hashed too
    $created = [];
    foreach ($defs as $table => $sql) {
        if (!$exists($table)) {
            $pdo->exec($sql);
            $created[] = $table;
        }
    }

    // Demo records for a fresh local setup
    if (in_array('specialties', $created, true)) {
        $pdo->exec("INSERT INTO specialties (name, description) VALUES
            ('Cardiology','Heart and blood pressure care'),
            ('Dermatology','Skin, hair and nail care'),
            ('Ophthalmology','Eye care'),
            ('Pediatrics','Care for children')");
    }
    if (in_array('doctors', $created, true)) {
        $pdo->exec("INSERT INTO doctors (name, specialty_id, room_number, available_days) VALUES
            ('Dr. Garcia (Cardiologist)', 1, 'Room 301', 'Mon,Wed,Fri'),
            ('Dr. Reyes (Dermatologist)', 2, 'Room 401', 'Tue,Thu,Sat'),
            ('Dr. Lim (Ophthalmologist)', 3, 'Room 501', 'Mon,Tue,Fri'),
            ('Dr. Cruz (Pediatrician)', 4, 'Room 201', 'Mon,Tue,Wed,Thu,Fri')");
    }
    if (in_array('users', $created, true)) {
        $pdo->exec("INSERT INTO users (username, password, full_name, role, contact_number) VALUES
            ('patient1','" . $demoHash . "','Juan Dela Cruz','patient','09123456789'),
            ('coordinator1','" . $demoHash . "','Nurse Liza Ramos','coordinator',NULL)");
        $pdo->exec("INSERT INTO users (username, password, full_name, role, doctor_id)
            SELECT 'doctor1', '" . $demoHash . "', name, 'doctor', id FROM doctors ORDER BY id LIMIT 1");
    }
    // Bring older local schemas up to date when possible.
    try {
        $need = [
            'appointments' => [
                'reference_code'      => 'VARCHAR(20) DEFAULT NULL',
                'patient_id'          => 'INT DEFAULT NULL',
                'patient_name'        => "VARCHAR(100) NOT NULL DEFAULT ''",
                'contact_number'      => 'VARCHAR(20) DEFAULT NULL',
                'specialty_id'        => 'INT DEFAULT NULL',
                'booked_by_role'      => "VARCHAR(20) DEFAULT 'patient'",
                'decline_reason'      => 'VARCHAR(255) DEFAULT NULL',
                'followup_timeframe'  => 'VARCHAR(100) DEFAULT NULL',
                'followup_notes'      => 'TEXT DEFAULT NULL',
                'forwarded_to_doctor' => 'TINYINT(1) NOT NULL DEFAULT 0',
                'coordinator_note'    => 'TEXT DEFAULT NULL',
                'cancel_reason'       => 'VARCHAR(255) DEFAULT NULL',
                'patient_notified'    => 'TINYINT(1) NOT NULL DEFAULT 0',
                'followup_relayed'    => 'TINYINT(1) NOT NULL DEFAULT 0',
                'parent_id'           => 'INT DEFAULT NULL',
                'reason_for_visit'    => 'VARCHAR(500) DEFAULT NULL',
            ],
            'doctors' => [
                'room_number'    => 'VARCHAR(20) DEFAULT NULL',
                'available_days' => "VARCHAR(100) DEFAULT 'Mon-Fri'",
                'status'         => "VARCHAR(20) NOT NULL DEFAULT 'Active'",
            ],
            'users' => [
                'doctor_id'      => 'INT DEFAULT NULL',
                'contact_number' => 'VARCHAR(20) DEFAULT NULL',
            ],
            'activity_logs' => [
                'role' => 'VARCHAR(20) DEFAULT NULL',
            ],
        ];
        foreach ($need as $table => $cols) {
            $have = $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($cols as $c => $ddl) {
                if (!in_array($c, $have, true)) $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$c` $ddl");
            }
        }

        // Relax obsolete required columns that can block newer inserts.
        $keep = ['id', 'doctor_id', 'appointment_date', 'appointment_time'];
        $rows = $pdo->query("SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
              AND IS_NULLABLE = 'NO' AND COLUMN_DEFAULT IS NULL
              AND EXTRA NOT LIKE '%auto_increment%'")->fetchAll();
        foreach ($rows as $r) {
            if (in_array($r['COLUMN_NAME'], $keep, true)) continue;
            $pdo->exec("ALTER TABLE appointments MODIFY `{$r['COLUMN_NAME']}` {$r['COLUMN_TYPE']} NULL DEFAULT NULL");
        }
    } catch (Throwable $e) { /* do not kill the request because of this */ }

    // Keep doctor user accounts linked to the correct doctor record.
    try {
        $clean = function ($name) {
            $n = preg_replace('/\(.*?\)/', '', (string)$name);          // remove the (Specialty)
            $n = preg_replace('/,?\s*M\.?D\.?\s*$/i', '', trim($n));    // remove ", M.D."
            $n = preg_replace('/^\s*Dr\.?\s*/i', '', $n);               // remove "Dr."
            return trim($n);
        };
        $surname = function ($name) use ($clean) {
            $w = preg_split('/\s+/', $clean($name), -1, PREG_SPLIT_NO_EMPTY);
            return $w ? strtolower(preg_replace('/[^a-z0-9]/i', '', end($w))) : '';
        };

        $docs = $pdo->query("SELECT id, name FROM doctors WHERE status = 'Active' ORDER BY id")->fetchAll();
        $bySurname = [];
        foreach ($docs as $dd) { $k = $surname($dd['name']); if ($k !== '') $bySurname[$k][] = (int)$dd['id']; }

        // Repair a doctor link when the account surname has one clear match.
        
        $accts = $pdo->query("SELECT id, username, full_name, doctor_id FROM users WHERE role = 'doctor' ORDER BY id")->fetchAll();
        $upd = $pdo->prepare("UPDATE users SET doctor_id = ? WHERE id = ?");
        foreach ($accts as $u) {
            $k = $surname($u['full_name']);
            if ($k !== '' && isset($bySurname[$k]) && count($bySurname[$k]) === 1) {
                $target = $bySurname[$k][0];
                if ((int)$u['doctor_id'] !== $target) $upd->execute([$target, $u['id']]);
            } elseif (empty($u['doctor_id'])) {
                // If no name match exists, use the first doctor without an account.
                $free = $pdo->query("SELECT d.id FROM doctors d LEFT JOIN users x ON x.doctor_id = d.id AND x.role = 'doctor'
                    WHERE d.status = 'Active' AND x.id IS NULL ORDER BY d.id LIMIT 1")->fetchColumn();
                if ($free) $upd->execute([$free, $u['id']]);
            }
        }

        // Create demo accounts for doctors that do not have one yet.
        $missing = $pdo->query("SELECT d.id, d.name FROM doctors d
            LEFT JOIN users u ON u.doctor_id = d.id AND u.role = 'doctor'
            WHERE d.status = 'Active' AND u.id IS NULL")->fetchAll();
        foreach ($missing as $m) {
            $slug = $surname($m['name']);
            $username = 'dr_' . ($slug !== '' ? $slug : 'doctor' . $m['id']);
            $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
            $chk->execute([$username]);
            if ((int)$chk->fetchColumn() > 0) $username .= '_' . $m['id'];
            $pdo->prepare("INSERT INTO users (username, password, full_name, role, doctor_id) VALUES (?,?,?,'doctor',?)")
                ->execute([$username, $demoHash, $m['name'], $m['id']]);
        }

        // Sync legacy doctors.user_id links when that column exists.
        $hasUid = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doctors' AND COLUMN_NAME = 'user_id'")->fetchColumn();
        if ((int)$hasUid > 0) {
            $pdo->exec("UPDATE doctors d SET d.user_id = (SELECT MIN(u.id) FROM users u WHERE u.role = 'doctor' AND u.doctor_id = d.id)");
        }

        // Normalize older nurse accounts to the coordinator role.
        $pdo->exec("DELETE FROM users WHERE role = 'nurse' AND username = 'nurse1'");
        $pdo->exec("UPDATE users SET role = 'coordinator' WHERE role = 'nurse'");
        $pdo->exec("DELETE FROM notifications WHERE target_role = 'nurse'");

        // Normalize older specialty labels to the current English labels.
        foreach ([' (Puso)', ' (Mata)', ' (Balat)', ' (Bata)'] as $suffix) {
            $pdo->prepare("UPDATE specialties SET name = REPLACE(name, ?, '') WHERE name LIKE ?")->execute([$suffix, '%' . $suffix]);
        }
        foreach ([
            'Pagtitingin sa puso%'      => 'Heart and blood pressure care',
            'Paggamot sa balat%'        => 'Skin, hair and nail care',
            'Pagtitingin at pag-alaga%' => 'Eye care',
            'Pangangalaga sa kalusugan ng mga bata%' => 'Care for children',
            'Pangkalahatang check-up%'  => 'General check-up and consultation',
        ] as $like => $en) {
            $pdo->prepare("UPDATE specialties SET description = ? WHERE description LIKE ?")->execute([$en, $like]);
        }

        // Normalize older appointment status values.
        $pdo->exec("UPDATE appointments SET status = 'Booked' WHERE status IN ('accept','accepted','booked')");
    } catch (Throwable $e) { /* do not kill the request because of this */ }

    // Upgrade any legacy plain-text demo passwords to password hashes.
    try {
        $rows = $pdo->query("SELECT id, password FROM users WHERE password NOT LIKE '$2y$%'")->fetchAll();
        $up = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
        foreach ($rows as $r) $up->execute([password_hash($r['password'], PASSWORD_DEFAULT), $r['id']]);
    } catch (Throwable $e) { error_log('[DocMatch] password hash migration: ' . $e->getMessage()); }

    // Enforce one active appointment per doctor, date, and time.
    // Cancelled and reassignment records release the slot.
    try {
        $has = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'active_slot'")->fetchColumn();
        if ((int)$has === 0) {
            $pdo->exec("ALTER TABLE appointments ADD COLUMN active_slot VARCHAR(40)
                GENERATED ALWAYS AS (IF(status IN ('Cancelled','Needs_Reassignment'), NULL,
                    CONCAT(doctor_id, '|', appointment_date, '|', appointment_time))) STORED");
        }
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND INDEX_NAME = 'uq_active_slot'")->fetchColumn();
        if ((int)$idx === 0) $pdo->exec("ALTER TABLE appointments ADD UNIQUE KEY uq_active_slot (active_slot)");
    } catch (Throwable $e) {
        // Existing duplicate active slots must be resolved before adding the index.
        error_log('[DocMatch] unique slot index not created: ' . $e->getMessage());
    }

    return $created;
}

// Shared helpers
function notify(PDO $pdo, string $role, $userId, string $title, string $message) {
    $pdo->prepare("INSERT INTO notifications (target_role, target_user_id, title, message) VALUES (?,?,?,?)")
        ->execute([$role, $userId, $title, $message]);
}

function log_activity(PDO $pdo, ?int $appointmentId, string $action, string $details = '') {
    try {
        $uid = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
        $role = $_SESSION['role'] ?? null;
        $pdo->prepare("INSERT INTO activity_logs (appointment_id,user_id,role,action,details) VALUES (?,?,?,?,?)")
            ->execute([$appointmentId, $uid, $role, $action, $details !== '' ? $details : null]);
    } catch (Throwable $e) { error_log('[DocMatch] activity log: ' . $e->getMessage()); }
}

// Notify user accounts linked to a doctor.
function notify_doctor(PDO $pdo, int $doctorId, string $title, string $message) {
    $s = $pdo->prepare("SELECT id FROM users WHERE role = 'doctor' AND doctor_id = ?");
    $s->execute([$doctorId]);
    foreach ($s->fetchAll(PDO::FETCH_COLUMN) as $uid) {
        notify($pdo, 'doctor', (int)$uid, $title, $message);
    }
}

// Block leave dates and flag affected appointments for reassignment.
function apply_leave_block(PDO $pdo, int $doctorId, string $start, string $end, string $reason, string $type): int {
    $period = new DatePeriod(new DateTime($start), new DateInterval('P1D'), (new DateTime($end))->modify('+1 day'));
    $chk = $pdo->prepare("SELECT COUNT(*) FROM doctor_blockouts WHERE doctor_id = ? AND block_date = ?");
    $ins = $pdo->prepare("INSERT INTO doctor_blockouts (doctor_id, block_date, type, reason) VALUES (?,?,?,?)");
    foreach ($period as $day) {
        $d = $day->format('Y-m-d');
        $chk->execute([$doctorId, $d]);
        if ((int)$chk->fetchColumn() === 0) $ins->execute([$doctorId, $d, $type, $reason]);
    }
    $u = $pdo->prepare("UPDATE appointments SET status = 'Needs_Reassignment', forwarded_to_doctor = 0, decline_reason = ?
        WHERE doctor_id = ? AND appointment_date BETWEEN ? AND ? AND status IN ('Pending','Booked','Proposed')");
    $u->execute(['Doctor unavailable (' . $reason . ')', $doctorId, $start, $end]);
    return $u->rowCount();
}

// Create a table only when it does not already exist.
try {
    ensure_schema($pdo);
} catch (Throwable $e) {
    error_log('[DocMatch] Schema setup failed: ' . $e->getMessage());
    json_out(['success' => false, 'message' => 'Database setup failed. Check the PHP error log.'], 500);
}

// Schedule helpers
// Clinic time slots shared with the booking UI.
function clinic_slots(): array {
    return ['09:00:00', '10:30:00', '13:30:00', '15:00:00'];
}

// Convert stored workday text to ISO weekday numbers; default to Monday-Friday.
function doctor_workdays($str): array {
    $map = ['mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6, 'sun' => 7];
    $days = [];
    foreach (explode(',', strtolower((string)$str)) as $tok) {
        $tok = trim($tok);
        if ($tok === '') continue;
        if (strpos($tok, '-') !== false) {
            $parts = array_map('trim', explode('-', $tok, 2));
            $a = $map[substr($parts[0], 0, 3)] ?? null;
            $b = $map[substr($parts[1], 0, 3)] ?? null;
            if ($a && $b) {
                $i = $a;
                for ($n = 0; $n < 7; $n++) {
                    $days[] = $i;
                    if ($i === $b) break;
                    $i = $i % 7 + 1;
                }
            }
        } elseif (isset($map[substr($tok, 0, 3)])) {
            $days[] = $map[substr($tok, 0, 3)];
        }
    }
    $days = array_values(array_unique($days));
    return $days ?: [1, 2, 3, 4, 5];
}

// Return a validation message when a slot is unavailable, otherwise null.
function slot_problem(PDO $pdo, int $doctorId, string $date, string $time, int $excludeId = 0): ?string {
    $s = $pdo->prepare("SELECT available_days FROM doctors WHERE id = ? AND status = 'Active'");
    $s->execute([$doctorId]);
    $row = $s->fetch();
    if (!$row) return 'Doctor not found.';

    $dow = (int)date('N', strtotime($date));
    if (!in_array($dow, doctor_workdays($row['available_days']), true)) {
        return 'That date is not a workday for the doctor.';
    }
    $b = $pdo->prepare("SELECT COUNT(*) FROM doctor_blockouts WHERE doctor_id = ? AND block_date = ?");
    $b->execute([$doctorId, $date]);
    if ((int)$b->fetchColumn() > 0) return 'The doctor is not available on that date.';

    $c = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
        AND status NOT IN ('Cancelled','Needs_Reassignment') AND id != ?");
    $c->execute([$doctorId, $date, $time, $excludeId]);
    if ((int)$c->fetchColumn() > 0) return 'That time slot is already taken.';
    return null;
}

function new_reference(PDO $pdo): string {
    do {
        $ref = 'REF-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        $c = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE reference_code = ?");
        $c->execute([$ref]);
    } while ((int)$c->fetchColumn() > 0);
    return $ref;
}


// Login and registration rate limiting
function client_ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45); }

// Return the remaining lockout time in seconds, or zero when allowed.
// All time math is done inside MySQL so PHP/MySQL timezone differences cannot skew it.
function rate_limit_wait(PDO $pdo, string $kind, string $username, int $max = 5, int $windowMin = 15): int {
    $pdo->exec("DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)");
    $q = $pdo->prepare("SELECT COUNT(*), TIMESTAMPDIFF(SECOND, NOW(), MIN(attempted_at) + INTERVAL $windowMin MINUTE)
        FROM login_attempts
        WHERE kind = ? AND ip = ? AND username = ? AND attempted_at > (NOW() - INTERVAL $windowMin MINUTE)");
    $q->execute([$kind, client_ip(), $username]);
    [$n, $secs] = $q->fetch(PDO::FETCH_NUM);
    $q2 = $pdo->prepare("SELECT COUNT(*) FROM login_attempts
        WHERE kind = ? AND ip = ? AND attempted_at > (NOW() - INTERVAL $windowMin MINUTE)");
    $q2->execute([$kind, client_ip()]);
    $ipTotal = (int)$q2->fetchColumn();
    if ((int)$n >= $max) return max(30, (int)$secs);
    if ($ipTotal >= $max * 4) return $windowMin * 60;
    return 0;
}
function rate_limit_hit(PDO $pdo, string $kind, string $username) {
    $pdo->prepare("INSERT INTO login_attempts (ip, username, kind) VALUES (?,?,?)")->execute([client_ip(), $username, $kind]);
}
function rate_limit_clear(PDO $pdo, string $kind, string $username) {
    $pdo->prepare("DELETE FROM login_attempts WHERE kind = ? AND ip = ? AND username = ?")->execute([$kind, client_ip(), $username]);
}
