<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

$userId = getAuthUserId();

if (!$userId) {
    echo json_encode([]);
    exit;
}

$pdo = getSPConnection();
$stmt = $pdo->prepare("SELECT song_id, hearts FROM sunoplay_hearts WHERE user_id = ?");
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$result = [];
foreach ($rows as $row) {
    $result[$row['song_id']] = (int)$row['hearts'];
}
echo json_encode($result);
