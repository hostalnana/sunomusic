<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

// Verificar que es admin (chemazener@gmail.com)
$userId = getAuthUserId();
if (!$userId) {
    echo json_encode(['success' => false, 'error' => 'Auth required']);
    exit;
}

$pdo = getSPConnection();
$stmt = $pdo->prepare("SELECT email FROM sunoplay_users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || $user['email'] !== 'chemazener@gmail.com') {
    echo json_encode(['success' => false, 'error' => 'Admin access only']);
    exit;
}

$action = $_GET['action'] ?? 'overview';

// === OVERVIEW: usuarios + stats ===
if ($action === 'overview') {
    // Usuarios con sus stats
    $users = $pdo->query("
        SELECT u.id, u.name, u.email, u.avatar, u.last_login,
               COUNT(h.song_id) as total_songs,
               COALESCE(SUM(h.hearts), 0) as total_hearts
        FROM sunoplay_users u
        LEFT JOIN sunoplay_hearts h ON u.id = h.user_id
        GROUP BY u.id
        ORDER BY u.last_login DESC
    ")->fetchAll();

    // Library stats
    $libFile = __DIR__ . '/../downloads/library.json';
    $library = file_exists($libFile) ? json_decode(file_get_contents($libFile), true) : [];
    $totalSize = array_sum(array_column($library, 'size'));

    // Canciones sin hearts de nadie
    $songIds = array_column($library, 'id');
    $withHearts = $pdo->query("SELECT DISTINCT song_id FROM sunoplay_hearts WHERE hearts > 0")->fetchAll(PDO::FETCH_COLUMN);
    $orphans = count(array_diff($songIds, $withHearts));

    echo json_encode([
        'success' => true,
        'users' => $users,
        'library' => [
            'total' => count($library),
            'totalSizeMB' => round($totalSize / 1048576, 1),
            'orphans' => $orphans
        ]
    ]);
    exit;
}

// === SONGS: lista completa con hearts por usuario ===
if ($action === 'songs') {
    $libFile = __DIR__ . '/../downloads/library.json';
    $library = file_exists($libFile) ? json_decode(file_get_contents($libFile), true) : [];

    // Hearts por canción y usuario
    $heartsData = $pdo->query("
        SELECT h.song_id, h.hearts, h.user_id, u.name as user_name
        FROM sunoplay_hearts h
        JOIN sunoplay_users u ON h.user_id = u.id
        ORDER BY h.song_id
    ")->fetchAll();

    $heartsMap = [];
    foreach ($heartsData as $h) {
        $heartsMap[$h['song_id']][] = [
            'userId' => (int)$h['user_id'],
            'userName' => $h['user_name'],
            'hearts' => (int)$h['hearts']
        ];
    }

    // Enriquecer canciones
    $songs = [];
    foreach ($library as $s) {
        $id = $s['id'];
        $userHearts = $heartsMap[$id] ?? [];
        $globalHearts = array_sum(array_column($userHearts, 'hearts'));
        $songs[] = [
            'id' => $id,
            'title' => $s['title'] ?? '?',
            'artist' => $s['artist'] ?? '?',
            'genre' => $s['genre'] ?? '',
            'tags' => $s['tags'] ?? [],
            'size' => $s['size'] ?? 0,
            'savedAt' => $s['savedAt'] ?? 0,
            'globalHearts' => $globalHearts,
            'userHearts' => $userHearts
        ];
    }

    echo json_encode(['success' => true, 'songs' => $songs]);
    exit;
}

// === DELETE: borrar canción ===
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $songId = $data['songId'] ?? '';
    if (empty($songId)) {
        echo json_encode(['success' => false, 'error' => 'songId required']);
        exit;
    }

    $libFile = __DIR__ . '/../downloads/library.json';
    $library = file_exists($libFile) ? json_decode(file_get_contents($libFile), true) : [];
    $newLib = [];
    foreach ($library as $song) {
        if ($song['id'] === $songId) {
            $audioFile = __DIR__ . '/../' . ($song['url'] ?? '');
            $thumbFile = __DIR__ . '/../' . ($song['thumb'] ?? '');
            if (file_exists($audioFile) && !str_contains($audioFile, 'icon.png')) @unlink($audioFile);
            if (file_exists($thumbFile) && !str_contains($thumbFile, 'icon.png')) @unlink($thumbFile);
        } else {
            $newLib[] = $song;
        }
    }
    file_put_contents($libFile, json_encode($newLib, JSON_PRETTY_PRINT));
    $pdo->prepare("DELETE FROM sunoplay_hearts WHERE song_id = ?")->execute([$songId]);

    echo json_encode(['success' => true, 'deleted' => $songId]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Unknown action']);
