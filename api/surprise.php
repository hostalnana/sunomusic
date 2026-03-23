<?php
header('Content-Type: application/json; charset=utf-8');

$source = $_GET['source'] ?? '';

$popularQueries = [
    'top hits 2025', 'best songs 2024', 'most popular music',
    'greatest hits', 'viral songs', 'trending music',
    'top 100 songs', 'best pop songs', 'best rock songs',
    'best electronic music', 'best hip hop', 'best latin music',
    'top dance songs', 'best indie songs', 'classic rock hits',
    'best jazz songs', 'best R&B songs', 'top reggaeton',
    'best EDM', 'top country songs', 'best metal songs',
    'best soul music', 'best funk songs', 'top disco hits',
    'best acoustic songs', 'chill lofi beats', 'best piano music',
    'top rap songs 2024', 'best blues songs', 'epic soundtrack music',
    'best alternative rock', 'top techno songs', 'best house music'
];

$ctx = stream_context_create([
    'http' => [
        'timeout' => 15,
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36\r\n"
    ]
]);

// === YOUTUBE ===
if ($source === 'youtube') {
    $ytdlp = trim(shell_exec('which yt-dlp 2>/dev/null'));
    if (!$ytdlp) {
        echo json_encode(['success' => false, 'error' => 'yt-dlp no disponible']);
        exit;
    }

    $query = $popularQueries[array_rand($popularQueries)];
    $searchQuery = "ytsearch15:{$query}";
    $cmd = sprintf(
        '%s %s --flat-playlist --dump-json --no-warnings --socket-timeout 10 2>/dev/null',
        escapeshellarg($ytdlp),
        escapeshellarg($searchQuery)
    );

    $output = [];
    exec($cmd, $output);

    $results = [];
    foreach ($output as $line) {
        $data = @json_decode($line, true);
        if (!$data || empty($data['id'])) continue;
        $duration = $data['duration'] ?? 0;
        if ($duration < 60 || $duration > 600) continue; // 1-10 min only

        $views = $data['view_count'] ?? 0;
        $thumb = '';
        if (!empty($data['thumbnails'])) {
            $thumb = end($data['thumbnails'])['url'] ?? '';
        }
        $results[] = [
            'id' => $data['id'],
            'title' => $data['title'] ?? 'Sin titulo',
            'artist' => $data['channel'] ?? $data['uploader'] ?? 'YouTube',
            'duration' => $duration,
            'views' => $views,
            'thumb' => $thumb,
            'url' => 'https://www.youtube.com/watch?v=' . $data['id']
        ];
    }

    // Sort by views descending, pick random from top results
    usort($results, function($a, $b) { return $b['views'] - $a['views']; });

    if (empty($results)) {
        echo json_encode(['success' => false, 'error' => 'No se encontraron resultados']);
        exit;
    }

    // Pick random from top results
    $topN = min(count($results), 10);
    $pick = $results[rand(0, $topN - 1)];

    echo json_encode([
        'success' => true,
        'query' => $query,
        'track' => $pick
    ]);
    exit;
}

// === TORRENT ===
if ($source === 'torrent') {
    $torrentQueries = [
        'discography FLAC', 'greatest hits mp3', 'best of album',
        'complete discography', 'studio albums', 'anthology',
        'top hits collection', 'essential mix', 'platinum collection',
        'gold album', 'remastered album', 'deluxe edition',
        'unplugged', 'live concert', 'acoustic sessions',
        'Beatles', 'Queen', 'Pink Floyd', 'Led Zeppelin',
        'Metallica', 'AC DC', 'Nirvana', 'Radiohead',
        'David Bowie', 'Michael Jackson', 'Stevie Wonder',
        'Bob Marley', 'Daft Punk', 'Depeche Mode',
        'The Rolling Stones', 'Fleetwood Mac', 'Eagles',
        'Red Hot Chili Peppers', 'Coldplay', 'U2',
        'Eminem', 'Kendrick Lamar', 'Drake',
        'Billie Eilish', 'Arctic Monkeys', 'Tame Impala'
    ];

    $query = $torrentQueries[array_rand($torrentQueries)];
    $apiUrl = 'https://apibay.org/q.php?q=' . urlencode($query) . '&cat=101';
    $apiResp = @file_get_contents($apiUrl, false, $ctx);

    $results = [];
    if ($apiResp) {
        $data = @json_decode($apiResp, true);
        if ($data && is_array($data)) {
            $valid = array_filter($data, function($item) {
                return !empty($item['name']) && ($item['id'] ?? '0') !== '0'
                    && (int)($item['seeders'] ?? 0) > 0;
            });
            usort($valid, function($a, $b) {
                return (int)($b['seeders'] ?? 0) - (int)($a['seeders'] ?? 0);
            });

            foreach (array_slice($valid, 0, 20) as $item) {
                $size = (int)$item['size'];
                // Skip very large (>500MB) or very small (<1MB)
                if ($size > 524288000 || $size < 1048576) continue;
                $results[] = [
                    'title' => $item['name'],
                    'magnet' => 'magnet:?xt=urn:btih:' . $item['info_hash'] .
                                '&dn=' . urlencode($item['name']) .
                                '&tr=udp://tracker.opentrackr.org:1337/announce' .
                                '&tr=udp://open.stealth.si:80/announce' .
                                '&tr=udp://tracker.openbittorrent.com:6969/announce',
                    'size' => formatBytes($size),
                    'seeders' => (int)($item['seeders'] ?? 0)
                ];
            }
        }
    }

    if (empty($results)) {
        echo json_encode(['success' => false, 'error' => 'No se encontraron torrents']);
        exit;
    }

    $topN = min(count($results), 10);
    $pick = $results[rand(0, $topN - 1)];

    echo json_encode([
        'success' => true,
        'query' => $query,
        'track' => $pick
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Fuente no valida (youtube|torrent)']);

function formatBytes($bytes) {
    if ($bytes <= 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB'];
    $i = 0;
    while ($bytes >= 1024 && $i < 3) { $bytes /= 1024; $i++; }
    return round($bytes, 1) . ' ' . $units[$i];
}
