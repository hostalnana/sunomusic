<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$q = isset($_GET['q']) ? strtolower(trim($_GET['q'])) : '';
$limit = min((int)($_GET['limit'] ?? 8), 20);

if (strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

$results = [];

// ===========================
// 1. Buscar en Suno clips.json
// ===========================
$CLIPS_FILE = __DIR__ . '/suno_clips.json';
$CDN_BASE = 'https://cdn1.suno.ai/';

$clipsData = @json_decode(file_get_contents($CLIPS_FILE), true);
if ($clipsData) {
    $seen = [];
    foreach ($clipsData as $genre => $clips) {
        // Comprobar si el género coincide
        $genreMatch = strpos(strtolower($genre), $q) !== false;

        foreach ($clips as $clip) {
            $titleLower = strtolower($clip['title'] ?? '');
            if ($genreMatch || strpos($titleLower, $q) !== false) {
                // Evitar duplicados por título limpio
                $cleanTitle = preg_replace('/ v[12]$/', '', $clip['title'] ?? '');
                if (isset($seen[$cleanTitle])) continue;
                $seen[$cleanTitle] = true;

                $results[] = [
                    'id'     => 'suno-' . $clip['id'],
                    'title'  => $clip['title'] ?? 'Suno Track',
                    'artist' => 'Suno AI',
                    'url'    => $CDN_BASE . $clip['id'] . '.mp3',
                    'thumb'  => 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300',
                    'genre'  => $genre,
                    'source' => 'suno'
                ];

                if (count($results) >= $limit) break 2;
            }
        }
    }
}

// Si ya tenemos suficientes, devolver sin llamar a Jamendo
if (count($results) >= $limit) {
    echo json_encode(array_values($results));
    exit;
}

// ===========================
// 2. Buscar en Jamendo (por nombre)
// ===========================
$CLIENT_ID = '2c9a11b9';
$BASE_URL  = 'https://api.jamendo.com/v3.0/tracks/';
$remaining = $limit - count($results);

$params = http_build_query([
    'client_id'   => $CLIENT_ID,
    'format'      => 'json',
    'limit'       => $remaining,
    'namesearch'  => $q,
    'order'       => 'popularity_week',
    'imagesize'   => 300,
    'audioformat' => 'mp32',
    'include'     => 'musicinfo'
]);

$ctx = stream_context_create(['http' => ['timeout' => 6]]);
$response = @file_get_contents($BASE_URL . '?' . $params, false, $ctx);

if ($response !== false) {
    $data = @json_decode($response, true);
    if ($data && $data['headers']['status'] === 'success' && !empty($data['results'])) {
        foreach ($data['results'] as $t) {
            $results[] = [
                'id'     => 'jamendo-' . $t['id'],
                'title'  => $t['name'],
                'artist' => $t['artist_name'] . ' (Jamendo)',
                'url'    => $t['audio'],
                'thumb'  => $t['image'],
                'genre'  => $t['musicinfo']['tags']['genres'][0] ?? 'Jamendo',
                'source' => 'jamendo'
            ];
        }
    }
}

echo json_encode(array_values($results));
