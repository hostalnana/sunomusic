<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

$data = json_decode(file_get_contents('php://input'), true);
$idToken = $data['id_token'] ?? '';

if (empty($idToken)) {
    echo json_encode(['success' => false, 'error' => 'Token requerido']);
    exit;
}

$googleData = verifyGoogleToken($idToken);
if (!$googleData) {
    echo json_encode(['success' => false, 'error' => 'Token inválido']);
    exit;
}

$user = getOrCreateUser($googleData);

// Migrar hearts existentes del JSON al usuario (primera vez)
$pdo = getSPConnection();
$heartsFile = __DIR__ . '/../data/hearts.json';
if (file_exists($heartsFile)) {
    $oldHearts = json_decode(file_get_contents($heartsFile), true) ?: [];
    $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM sunoplay_hearts WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $count = $stmt->fetch()['c'];

    if ($count == 0 && !empty($oldHearts)) {
        $insert = $pdo->prepare("INSERT IGNORE INTO sunoplay_hearts (user_id, song_id, hearts) VALUES (?, ?, ?)");
        foreach ($oldHearts as $songId => $heartData) {
            $h = is_array($heartData) ? ($heartData['hearts'] ?? 3) : (int)$heartData;
            $insert->execute([$user['id'], $songId, $h]);
        }
    }
}

echo json_encode([
    'success' => true,
    'session_token' => $user['session_token'],
    'user' => [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'avatar' => $user['avatar']
    ]
]);
