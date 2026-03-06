<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

$data = json_decode(file_get_contents('php://input'), true);
$songId = $data['songId'] ?? '';
$hearts = intval($data['hearts'] ?? 0);

if (empty($songId)) {
    echo json_encode(['success' => false, 'error' => 'Song ID required']);
    exit;
}

$userId = getAuthUserId();

if (!$userId) {
    echo json_encode(['success' => false, 'error' => 'Auth required']);
    exit;
}

$pdo = getSPConnection();

// Guardar hearts del usuario
$pdo->prepare("INSERT INTO sunoplay_hearts (user_id, song_id, hearts) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE hearts = ?")
    ->execute([$userId, $songId, $hearts, $hearts]);

// Comprobar suma global de hearts de TODOS los usuarios para esta canción
$stmt = $pdo->prepare("SELECT COALESCE(SUM(hearts), 0) as total FROM sunoplay_hearts WHERE song_id = ?");
$stmt->execute([$songId]);
$globalSum = (int)$stmt->fetch()['total'];

// Si la suma global es <= 0, eliminar canción de la biblioteca y de todos los hearts
if ($globalSum <= 0) {
    // Eliminar de la biblioteca (library.json)
    $libFile = __DIR__ . '/../downloads/library.json';
    if (file_exists($libFile)) {
        $library = json_decode(file_get_contents($libFile), true) ?: [];
        $newLibrary = [];
        foreach ($library as $song) {
            if ($song['id'] == $songId) {
                // Borrar archivos
                $audioFile = __DIR__ . '/../' . ($song['url'] ?? '');
                $thumbFile = __DIR__ . '/../' . ($song['thumb'] ?? '');
                if (file_exists($audioFile) && !str_contains($audioFile, 'icon.png')) @unlink($audioFile);
                if (file_exists($thumbFile) && !str_contains($thumbFile, 'icon.png')) @unlink($thumbFile);
            } else {
                $newLibrary[] = $song;
            }
        }
        file_put_contents($libFile, json_encode($newLibrary, JSON_PRETTY_PRINT));
    }

    // Eliminar hearts de todos los usuarios para esta canción
    $pdo->prepare("DELETE FROM sunoplay_hearts WHERE song_id = ?")->execute([$songId]);

    echo json_encode(['success' => true, 'songId' => $songId, 'hearts' => $hearts, 'globalSum' => $globalSum, 'deleted' => true]);
    exit;
}

echo json_encode(['success' => true, 'songId' => $songId, 'hearts' => $hearts, 'globalSum' => $globalSum, 'deleted' => false]);
