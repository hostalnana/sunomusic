<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

$userId = getAuthUserId();
if (!$userId) {
    echo json_encode(['success' => false]);
    exit;
}

$pdo = getSPConnection();
$stmt = $pdo->prepare("SELECT id, name, email, avatar FROM sunoplay_users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if ($user) {
    echo json_encode(['success' => true, 'user' => [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'avatar' => $user['avatar']
    ]]);
} else {
    echo json_encode(['success' => false]);
}
