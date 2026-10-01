<?php
require_once __DIR__ . '/../db.php';
require_login();
try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $s=$pdo->prepare("SELECT id,username,full_name,role,doctor_id,contact_number FROM users WHERE id=?");
        $s->execute([$_SESSION['user_id']]);
        json_out(['success'=>true,'user'=>$s->fetch()]);
    }
    $d=json_input();
    $name=trim(preg_replace('/\\s+/', ' ', (string)($d['full_name']??'')));
    $contact=trim((string)($d['contact_number']??''));
    if(mb_strlen($name)<2||mb_strlen($name)>100) json_out(['success'=>false,'message'=>'Enter a valid full name.'],422);
    if($contact!==''&&!preg_match('/^[0-9+\\-\\s()]{7,20}$/',$contact)) json_out(['success'=>false,'message'=>'Enter a valid contact number.'],422);
    $pdo->prepare("UPDATE users SET full_name=?, contact_number=? WHERE id=?")->execute([$name,$contact?:null,$_SESSION['user_id']]);
    $_SESSION['full_name']=$name;
    json_out(['success'=>true,'user'=>['full_name'=>$name,'contact_number'=>$contact]]);
} catch(Throwable $e){ fail($e); }
