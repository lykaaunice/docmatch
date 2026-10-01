<?php
require_once __DIR__ . '/../db.php';
require_login(['patient','doctor']);

function allowed_appointment(PDO $pdo, int $appointmentId): array {
    $st=$pdo->prepare("SELECT a.*, d.name doctor_name FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.id=? LIMIT 1");
    $st->execute([$appointmentId]); $a=$st->fetch();
    if(!$a) json_out(['success'=>false,'message'=>'Appointment not found.'],404);
    $ok=$_SESSION['role']==='patient' ? ((int)$a['patient_id']===(int)$_SESSION['user_id']) : ((int)$a['doctor_id']===(int)($_SESSION['doctor_id']??0));
    if(!$ok) json_out(['success'=>false,'message'=>'You cannot access this conversation.'],403);
    if(empty($a['patient_id'])) json_out(['success'=>false,'message'=>'Messaging is unavailable for walk-in records without a patient account.'],400);
    return $a;
}

if($_SERVER['REQUEST_METHOD']==='POST'){
    $in=json_input(); $aid=(int)($in['appointment_id']??0); $msg=trim((string)($in['message']??''));
    if(!$aid||$msg==='') json_out(['success'=>false,'message'=>'Choose a conversation and enter a message.'],422);
    if(mb_strlen($msg)>1000) json_out(['success'=>false,'message'=>'Message is too long.'],422);
    $a=allowed_appointment($pdo,$aid);
    if(in_array($a['status'],['Cancelled','Declined'],true)) json_out(['success'=>false,'message'=>'This appointment conversation is closed.'],409);
    $sender=(int)$_SESSION['user_id'];
    if($_SESSION['role']==='patient'){
        $st=$pdo->prepare("SELECT id FROM users WHERE role='doctor' AND doctor_id=? LIMIT 1"); $st->execute([$a['doctor_id']]); $receiver=(int)$st->fetchColumn();
    } else $receiver=(int)$a['patient_id'];
    if(!$receiver) json_out(['success'=>false,'message'=>'The other participant does not have a messaging account.'],409);
    $st=$pdo->prepare("INSERT INTO messages(appointment_id,sender_user_id,receiver_user_id,message) VALUES(?,?,?,?)"); $st->execute([$aid,$sender,$receiver,$msg]);
    json_out(['success'=>true]);
}

$uid=(int)$_SESSION['user_id']; $role=$_SESSION['role']; $docid=(int)($_SESSION['doctor_id']??0);
$where=$role==='patient' ? 'a.patient_id=?' : 'a.doctor_id=?'; $who=$role==='patient' ? $uid : $docid;
$sql="SELECT a.id appointment_id,a.reference_code,a.patient_name,a.appointment_date,a.status,d.name doctor_name,
 (SELECT COUNT(*) FROM messages m WHERE m.appointment_id=a.id AND m.receiver_user_id=? AND m.is_read=0) unread_count
 FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE $where AND a.patient_id IS NOT NULL ORDER BY a.appointment_date DESC,a.appointment_time DESC";
$st=$pdo->prepare($sql); $st->execute([$uid,$who]); $convs=$st->fetchAll();
$aid=(int)($_GET['appointment_id']??0); $msgs=[];
if($aid){ allowed_appointment($pdo,$aid); $pdo->prepare("UPDATE messages SET is_read=1 WHERE appointment_id=? AND receiver_user_id=?")->execute([$aid,$uid]);
 $st=$pdo->prepare("SELECT m.*,u.full_name sender_name FROM messages m JOIN users u ON u.id=m.sender_user_id WHERE m.appointment_id=? ORDER BY m.created_at,m.id"); $st->execute([$aid]); $msgs=$st->fetchAll(); }
$st=$pdo->prepare("SELECT COUNT(*) FROM messages WHERE receiver_user_id=? AND is_read=0"); $st->execute([$uid]);
json_out(['success'=>true,'conversations'=>$convs,'messages'=>$msgs,'unread_total'=>(int)$st->fetchColumn()]);
