<?php
/**
 * Limpieza de biblioteca: borra canciones sin corazones de ningún usuario
 * y con más de 7 días de antigüedad.
 * Ejecutar via cron: 0 4 * * * php /var/www/html/lomastrend/sunoplay/api/cleanup_library.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/db_config.php';

$dryRun = isset($_GET['dry']) || (isset($argv[1]) && $argv[1] === '--dry');
$minAgeDays = (int)($_GET['days'] ?? 7); // Mínimo 7 días de antigüedad

$libFile = __DIR__ . '/../downloads/library.json';
if (!file_exists($libFile)) {
    echo json_encode(['success' => false, 'error' => 'No library file']);
    exit;
}

$library = json_decode(file_get_contents($libFile), true) ?: [];
$pdo = getSPConnection();

// Obtener todas las canciones que tienen al menos 1 heart de algún usuario
$stmt = $pdo->query("SELECT song_id, SUM(hearts) as total FROM sunoplay_hearts GROUP BY song_id");
$heartsMap = [];
while ($row = $stmt->fetch()) {
    $heartsMap[$row['song_id']] = (int)$row['total'];
}

$now = time() * 1000; // milliseconds (savedAt format)
$minAgeMs = $minAgeDays * 86400 * 1000;

$kept = [];
$deleted = [];
$freedBytes = 0;

foreach ($library as $song) {
    $songId = $song['id'];
    $globalHearts = $heartsMap[$songId] ?? 0;
    $savedAt = $song['savedAt'] ?? 0;
    $age = $now - $savedAt;

    // Borrar si: no tiene hearts de ningún usuario Y tiene más de X días
    if ($globalHearts <= 0 && $age > $minAgeMs) {
        $deleted[] = [
            'id' => $songId,
            'title' => $song['title'] ?? '?',
            'hearts' => $globalHearts,
            'ageDays' => round($age / 86400000, 1),
            'size' => $song['size'] ?? 0
        ];
        $freedBytes += $song['size'] ?? 0;

        if (!$dryRun) {
            // Borrar archivos
            $audioFile = __DIR__ . '/../' . ($song['url'] ?? '');
            $thumbFile = __DIR__ . '/../' . ($song['thumb'] ?? '');
            if (file_exists($audioFile) && !str_contains($audioFile, 'icon.png')) @unlink($audioFile);
            if (file_exists($thumbFile) && !str_contains($thumbFile, 'icon.png')) @unlink($thumbFile);

            // Borrar hearts residuales
            $pdo->prepare("DELETE FROM sunoplay_hearts WHERE song_id = ?")->execute([$songId]);
        }
    } else {
        $kept[] = $song;
    }
}

if (!$dryRun && count($deleted) > 0) {
    file_put_contents($libFile, json_encode($kept, JSON_PRETTY_PRINT));
}

$freedMB = round($freedBytes / 1048576, 1);

echo json_encode([
    'success' => true,
    'dryRun' => $dryRun,
    'minAgeDays' => $minAgeDays,
    'totalBefore' => count($library),
    'totalAfter' => count($kept),
    'deleted' => count($deleted),
    'freedMB' => $freedMB,
    'deletedSongs' => $deleted
], JSON_PRETTY_PRINT);
