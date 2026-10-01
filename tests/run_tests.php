<?php
// DocMatch integration tests (run against your local XAMPP install).
//   php tests/run_tests.php [base_url]        default base_url: http://localhost/docmatch
// Needs: PHP CLI with the curl extension, Apache + MySQL running.
// It creates a few throw-away patient accounts (test_*) and cancels the appointment it books.

$base = rtrim($argv[1] ?? 'http://localhost/docmatch', '/') . '/backend/api/';
$pass = 0; $failN = 0;
function check(string $name, bool $ok, string $extra = '') {
    global $pass, $failN;
    $ok ? $pass++ : $failN++;
    echo ($ok ? "  [PASS] " : "  [FAIL] ") . $name . ($ok || $extra === '' ? '' : "  -> $extra") . "\n";
}

// A tiny browser: own cookie jar, remembers the CSRF token.
class Client {
    public $jar; public $csrf = '';
    function __construct() { $this->jar = tempnam(sys_get_temp_dir(), 'dm'); }
    function handle(string $ep, ?array $body = null, bool $sendCsrf = true) {
        $ch = curl_init($GLOBALS['base'] . $ep);
        $this->setup($ch, $ep, $body, $sendCsrf);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return $this->parse($raw, $code);
    }
    function setup($ch, $ep, $body, $sendCsrf) {
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar]);
        if ($body !== null) {
            $h = ['Content-Type: application/json'];
            if ($sendCsrf) $h[] = 'X-CSRF-Token: ' . $this->csrf;
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body), CURLOPT_HTTPHEADER => $h]);
        }
    }
    function parse($raw, $code) {
        $d = json_decode((string)$raw, true) ?: [];
        if (!empty($d['csrf'])) $this->csrf = $d['csrf'];
        $d['_code'] = $code; $d['_raw'] = $raw;
        return $d;
    }
    function start() { return $this->handle('check_session.php'); }
}

echo "\n== 1. CSRF ==\n";
$c = new Client(); $c->start();
$r = $c->handle('login.php', ['username' => 'patient1', 'password' => '123456'], false);
check('POST without CSRF token is rejected (403)', $r['_code'] === 403, $r['_raw']);
$c2 = new Client(); $c2->start(); $c2->csrf = 'wrong-token';
$r = $c2->handle('login.php', ['username' => 'patient1', 'password' => '123456']);
check('POST with wrong CSRF token is rejected (403)', $r['_code'] === 403);
$r = $c->handle('logout.php');
check('logout via GET is refused (405)', $r['_code'] === 405);

echo "\n== 2. Registration ==\n";
$u1 = 'test_' . bin2hex(random_bytes(3)); $u2 = 'test_' . bin2hex(random_bytes(3));
$reg = fn($c, $o) => $c->handle('register.php', $o + ['full_name' => 'Test Patient', 'contact_number' => '09171234567', 'username' => 'x', 'password' => 'password123']);
$r = $reg($c, ['username' => 'ab']);              check('too-short username rejected', $r['_code'] === 422);
$r = $reg($c, ['username' => 'dr_hacker']);       check('reserved "dr_" username rejected', $r['_code'] === 422);
$r = $reg($c, ['username' => $u1, 'password' => 'short']); check('password under 8 chars rejected', $r['_code'] === 422);
$r = $reg($c, ['username' => $u1, 'contact_number' => 'abc']); check('invalid contact number rejected', $r['_code'] === 422);
$r = $reg($c, ['username' => $u1]);               check('valid registration succeeds', !empty($r['success']), $r['_raw']);
$r = $reg($c, ['username' => strtoupper($u1)]);   check('duplicate username (any case) rejected (409)', $r['_code'] === 409, $r['_raw']);
$r = $reg($c, ['username' => $u2]);               check('second account created', !empty($r['success']), $r['_raw']);

echo "\n== 3. Login + rate limiting ==\n";
$a = new Client(); $a->start();
$r = $a->handle('login.php', ['username' => $u1, 'password' => 'password123']);
check('new patient can log in', !empty($r['success']) && ($r['user']['role'] ?? '') === 'patient', $r['_raw']);
check('login returns a fresh CSRF token', !empty($r['csrf']));
$r = $a->handle('get_overview.php');
check('session works after login', !empty($r['success']));
$bad = new Client(); $bad->start(); $codes = [];
for ($i = 0; $i < 7; $i++) $codes[] = $bad->handle('login.php', ['username' => $u2, 'password' => 'wrong-password'])['_code'];
check('wrong passwords give 401, then 429 after 5 failures', array_slice($codes, 0, 5) === [401, 401, 401, 401, 401] && $codes[5] === 429, implode(',', $codes));
$r = $bad->handle('login.php', ['username' => $u2, 'password' => 'password123']);
check('correct password is also blocked while locked out (429)', $r['_code'] === 429);
$r = $a->handle('logout.php', []);
check('logout via POST works', !empty($r['success']));
$r = $a->handle('get_overview.php');
check('API refuses access after logout (401)', $r['_code'] === 401);

echo "\n== 4. Errors do not leak details ==\n";
$r = $bad->handle('login.php', ['username' => str_repeat('a', 80), 'password' => 'x']);
check('no SQL / file paths in error responses', !preg_match('/SQLSTATE|PDOException|\.php|Stack trace/i', $r['_raw']), $r['_raw']);

echo "\n== 5. Double booking (two patients, same slot, at the same instant) ==\n";
// Two logged-in patients
$p1 = new Client(); $p1->start(); $p1->handle('login.php', ['username' => $u1, 'password' => 'password123']);
$p2 = new Client(); $p2->start(); $r2 = $p2->handle('login.php', ['username' => 'patient1', 'password' => '123456']);
if (empty($r2['success'])) { // u2 may be locked out by test 3; make another one
    $u3 = 'test_' . bin2hex(random_bytes(3)); $p2->handle('register.php', ['full_name' => 'Test Two', 'contact_number' => '09170000000', 'username' => $u3, 'password' => 'password123']);
    $p2->handle('login.php', ['username' => $u3, 'password' => 'password123']);
}
$ov = $p1->handle('get_overview.php'); $doctor = $ov['doctors'][0]['id'] ?? 0;
check('a doctor exists to book with', $doctor > 0);

$slots = ['09:00', '10:30', '13:30', '15:00']; $booked = null; $tested = 0;
for ($day = 30; $day < 120 && !$booked; $day++) {          // start far ahead so we do not disturb real data
    $date = date('Y-m-d', strtotime("+$day days"));
    $slot = $slots[$day % 4];
    $body = ['doctor_id' => $doctor, 'appointment_date' => $date, 'appointment_time' => $slot];
    // fire both requests in parallel
    $mh = curl_multi_init(); $hs = [];
    foreach ([$p1, $p2] as $k => $cl) {
        $ch = curl_init($base . 'book.php'); $cl->setup($ch, 'book.php', $body, true);
        curl_multi_add_handle($mh, $ch); $hs[$k] = $ch;
    }
    do { curl_multi_exec($mh, $running); curl_multi_select($mh, 0.05); } while ($running > 0);
    $res = [];
    foreach ($hs as $k => $ch) {
        $res[$k] = json_decode(curl_multi_getcontent($ch), true) ?: [];
        $res[$k]['_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($mh, $ch);
    }
    curl_multi_close($mh);
    $wins = count(array_filter($res, fn($x) => !empty($x['success'])));
    $notWorkday = count(array_filter($res, fn($x) => stripos($x['message'] ?? '', 'workday') !== false || stripos($x['message'] ?? '', 'not available') !== false));
    if ($notWorkday === 2) continue;                          // not a working day for this doctor; try the next date
    $tested++;
    check("exactly ONE of two simultaneous bookings succeeds ($date $slot)", $wins === 1,
        "wins=$wins; " . json_encode([$res[0]['message'] ?? '', $res[1]['message'] ?? '']));
    $loser = array_values(array_filter($res, fn($x) => empty($x['success'])))[0] ?? [];
    check('the loser gets a clear "slot taken / busy" message (409), not a server error', ($loser['_code'] ?? 0) === 409, json_encode($loser));
    $booked = $wins === 1;
    // clean up: cancel whichever one won
    foreach ([[$p1, $res[0]], [$p2, $res[1]]] as [$cl, $x]) {
        if (!empty($x['success'])) {
            $list = $cl->handle('get_admin_appointments.php');
            foreach (($list['appointments'] ?? []) as $ap) if (($ap['reference_code'] ?? '') === $x['reference_code']) {
                $cl->handle('patient_actions.php', ['action' => 'cancel', 'appointment_id' => $ap['id'], 'reason' => 'automated test']);
            }
        }
    }
}
check('found a bookable date to test the race', $tested > 0, 'no working day found in the next 120 days');

echo "\nResult: $pass passed, $failN failed\n";
exit($failN ? 1 : 0);
