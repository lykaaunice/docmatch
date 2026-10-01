<?php
// Optional migration helper for older local installations.
// Existing records are kept; only missing schema pieces are added.
// Restrict this maintenance script to localhost or CLI use.
if (PHP_SAPI !== 'cli' && !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit('Forbidden');
}
require_once __DIR__ . '/db.php';
header('Content-Type: text/plain; charset=utf-8');

$log = [];
function has_table($pdo, $t) {
    $s = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
    $s->execute([$t]); return $s->fetchColumn() > 0;
}
function has_col($pdo, $t, $c) {
    $s = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $s->execute([$t, $c]); return $s->fetchColumn() > 0;
}
function run($pdo, $label, $sql) {
    try { $pdo->exec($sql); echo "[OK]   $label\n"; }
    catch (Throwable $e) { echo "[FAIL] $label -> " . $e->getMessage() . "\n"; }
}
function ensure_col($pdo, $t, $c, $ddl) {
    if (!has_table($pdo, $t)) { echo "[SKIP] table $t does not exist\n"; return; }
    if (has_col($pdo, $t, $c)) { echo "[--]   $t.$c already exists\n"; return; }
    run($pdo, "add $t.$c", "ALTER TABLE `$t` ADD COLUMN `$c` $ddl");
}

// Tables used by newer releases
if (!has_table($pdo, 'notifications')) {
    run($pdo, 'create notifications', "CREATE TABLE notifications (
        id INT AUTO_INCREMENT PRIMARY KEY, target_role VARCHAR(20) NOT NULL, target_user_id INT DEFAULT NULL,
        title VARCHAR(150) NOT NULL, message TEXT NOT NULL, is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
}
if (!has_table($pdo, 'doctor_blockouts')) {
    run($pdo, 'create doctor_blockouts', "CREATE TABLE doctor_blockouts (
        id INT AUTO_INCREMENT PRIMARY KEY, doctor_id INT NOT NULL, block_date DATE NOT NULL,
        type VARCHAR(30) DEFAULT 'emergency', reason VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
}

// User accounts
if (!has_table($pdo, 'users')) {
    run($pdo, 'create users table', "CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        doctor_id INT DEFAULT NULL,
        contact_number VARCHAR(20) DEFAULT NULL)");
    run($pdo, 'demo: patient1',      "INSERT INTO users (username,password,full_name,role,contact_number) VALUES ('patient1','123456','Juan Dela Cruz','patient','09123456789')");
    run($pdo, 'demo: coordinator1',  "INSERT INTO users (username,password,full_name,role) VALUES ('coordinator1','123456','Nurse Liza Ramos','coordinator')");
    run($pdo, 'demo: doctor1',       "INSERT INTO users (username,password,full_name,role,doctor_id) SELECT 'doctor1','123456',name,'doctor',id FROM doctors ORDER BY id LIMIT 1");
}

// Appointment fields
ensure_col($pdo, 'appointments', 'reference_code',    'VARCHAR(20) DEFAULT NULL');
ensure_col($pdo, 'appointments', 'patient_id',        'INT DEFAULT NULL');
ensure_col($pdo, 'appointments', 'patient_name',      "VARCHAR(100) NOT NULL DEFAULT ''");
ensure_col($pdo, 'appointments', 'contact_number',    'VARCHAR(20) DEFAULT NULL');
ensure_col($pdo, 'appointments', 'specialty_id',      'INT DEFAULT NULL');
ensure_col($pdo, 'appointments', 'booked_by_role',    "VARCHAR(20) DEFAULT 'patient'");
ensure_col($pdo, 'appointments', 'decline_reason',    'VARCHAR(255) DEFAULT NULL');
ensure_col($pdo, 'appointments', 'followup_timeframe','VARCHAR(100) DEFAULT NULL');
ensure_col($pdo, 'appointments', 'followup_notes',    'TEXT DEFAULT NULL');
ensure_col($pdo, 'appointments', 'created_at',        'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

// Use VARCHAR so workflow statuses can evolve without changing an ENUM.
run($pdo, 'status -> VARCHAR(30)', "ALTER TABLE appointments MODIFY status VARCHAR(30) NOT NULL DEFAULT 'Pending'");
run($pdo, 'patient_id can be NULL (walk-in)', "ALTER TABLE appointments MODIFY patient_id INT NULL");
run($pdo, "fix 'pending' -> 'Pending'", "UPDATE appointments SET status = CONCAT(UPPER(LEFT(status,1)), SUBSTRING(status,2)) WHERE status IN ('pending','booked','cancelled')");
run($pdo, 'fill specialty_id from the doctor', "UPDATE appointments a JOIN doctors d ON a.doctor_id = d.id SET a.specialty_id = d.specialty_id WHERE a.specialty_id IS NULL");
run($pdo, 'fill missing reference_code', "UPDATE appointments SET reference_code = CONCAT('REF-', UPPER(SUBSTRING(MD5(CONCAT(id, RAND())),1,8))) WHERE reference_code IS NULL OR reference_code = ''");

// Doctor fields
ensure_col($pdo, 'doctors', 'room_number',    'VARCHAR(20) DEFAULT NULL');
ensure_col($pdo, 'doctors', 'available_days', "VARCHAR(100) DEFAULT 'Mon-Fri'");
ensure_col($pdo, 'doctors', 'status',         "VARCHAR(20) NOT NULL DEFAULT 'Active'");

// User fields
ensure_col($pdo, 'users', 'doctor_id',      'INT DEFAULT NULL');
ensure_col($pdo, 'users', 'contact_number', 'VARCHAR(20) DEFAULT NULL');
run($pdo, 'widen the password column (for hashing)', "ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL");

// Link older doctor accounts to doctor records when possible.
try {
    $docUsers = $pdo->query("SELECT id, full_name FROM users WHERE role = 'doctor' AND doctor_id IS NULL")->fetchAll();
    foreach ($docUsers as $u) {
        $s = $pdo->prepare("SELECT id FROM doctors WHERE name = ? OR name LIKE ? LIMIT 1");
        $s->execute([$u['full_name'], '%' . trim(preg_replace('/^Dr\.?\s*/i', '', $u['full_name'])) . '%']);
        $did = $s->fetchColumn() ?: $pdo->query("SELECT MIN(id) FROM doctors")->fetchColumn();
        if ($did) {
            $pdo->prepare("UPDATE users SET doctor_id = ? WHERE id = ?")->execute([$did, $u['id']]);
            echo "[OK]   linked user #{$u['id']} ({$u['full_name']}) to doctor #$did\n";
        }
    }
} catch (Throwable $e) { echo "[FAIL] link doctor users -> " . $e->getMessage() . "\n"; }

echo "\n=== Done. Current appointments columns ===\n";
foreach ($pdo->query("SHOW COLUMNS FROM appointments")->fetchAll() as $c) echo " - {$c['Field']} ({$c['Type']})\n";
echo "\nYou can now refresh the app. You may delete migrate.php.\n";
