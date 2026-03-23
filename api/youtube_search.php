<?php
header('Content-Type: application/json');

$query = $_GET['q'] ?? '';
$limit = min(max((int)($_GET['limit'] ?? 8), 1), 15);

if (strlen($query) < 2) {
    echo json_encode([]);
    exit;
}

$ytdlp = trim(shell_exec('which yt-dlp 2>/dev/null'));
if (!$ytdlp) {
    echo json_encode(['error' => 'yt-dlp no disponible']);
    exit;
}

// Search YouTube with yt-dlp flat-playlist mode (fast, no download)
$searchQuery = "ytsearch{$limit}:{$query} music";
$cmd = sprintf(
    '%s %s --flat-playlist --dump-json --no-warnings --socket-timeout 10 2>/dev/null',
    escapeshellarg($ytdlp),
    escapeshellarg($searchQuery)
);

$output = [];
exec($cmd, $output, $ret);

if (empty($output)) {
    echo json_encode([]);
    exit;
}

$results = [];
foreach ($output as $line) {
    $data = @json_decode($line, true);
    if (!$data || empty($data['id'])) continue;

    // Skip very long videos (likely not music)
    $duration = $data['duration'] ?? 0;
    if ($duration > 600) continue; // Max 10 min

    $views = $data['view_count'] ?? 0;
    $thumb = '';
    if (!empty($data['thumbnails'])) {
        $thumb = end($data['thumbnails'])['url'] ?? '';
    }

    $results[] = [
        'id' => $data['id'],
        'title' => $data['title'] ?? 'Sin título',
        'artist' => $data['channel'] ?? $data['uploader'] ?? 'YouTube',
        'duration' => $duration,
        'durationStr' => $data['duration_string'] ?? '',
        'views' => $views,
        'viewsStr' => formatViews($views),
        'thumb' => $thumb,
        'url' => 'https://www.youtube.com/watch?v=' . $data['id'],
        'verified' => !empty($data['channel_is_verified'])
    ];
}

// Sort by views descending
usort($results, function($a, $b) { return $b['views'] - $a['views']; });

echo json_encode($results);

function formatViews($n) {
    if ($n >= 1000000000) return round($n / 1000000000, 1) . 'B';
    if ($n >= 1000000) return round($n / 1000000, 1) . 'M';
    if ($n >= 1000) return round($n / 1000, 1) . 'K';
    return (string)$n;
}
