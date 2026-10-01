<?php
require_once __DIR__ . '/../db.php';
require_login();
try {
    $d=json_input(); $old=(string)($d['current_password']??''); $new=(string)($d['new_password']??'');
    if(strlen($new)<8||strlen($new)>72) json_out(['success'=>false,'message'=>'New password must be 8-72 characters.'],422);
    $s=$pdo->prepare("SELECT password FROM users WHERE id=?"); $s->execute([$_SESSION['user_id']]); $hash=$s->fetchColumn();
    if(!$hash||!password_verify($old,$hash)) json_out(['success'=>false,'message'=>'Current password is incorrect.'],422);
    $pdo->prepare("UPDATE users SET password=? WHERE id=?")->execute([password_hash($new,PASSWORD_DEFAULT),$_SESSION['user_id']]);
    json_out(['success'=>true]);
} catch(Throwable $e){ fail($e); }
