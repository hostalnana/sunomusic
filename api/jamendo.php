<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$CLIENT_ID = '2c9a11b9';
$BASE_URL = 'https://api.jamendo.com/v3.0/tracks/';

$defaultTags = ['electronic', 'rock', 'pop', 'jazz', 'ambient', 'hiphop', 'classical', 'chillout', 'lounge', 'dance', 'indie', 'metal', 'reggae', 'soul', 'funk', 'blues', 'techno', 'house', 'trance', 'dubstep'];

$tag = isset($_GET['tag']) ? preg_replace('/[^a-zA-Z0-9\-_ ]/', '', $_GET['tag']) : $defaultTags[array_rand($defaultTags)];
$limit = 5;
$offset = rand(0, 300);

$params = http_build_query([
    'client_id'   => $CLIENT_ID,
    'format'      => 'json',
    'limit'       => $limit,
    'offset'      => $offset,
    'order'       => 'popularity_week',
    'tags'        => strtolower($tag),
    'imagesize'   => 400,
    'audioformat' => 'mp32',
    'include'     => 'musicinfo'
]);

$url = $BASE_URL . '?' . $params;

$ctx = stream_context_create(['http' => ['timeout' => 8]]);
$response = @file_get_contents($url, false, $ctx);

if ($response === false) {
    // Retry without tag filter
    $params2 = http_build_query([
        'client_id'   => $CLIENT_ID,
        'format'      => 'json',
        'limit'       => $limit,
        'offset'      => rand(0, 200),
        'order'       => 'popularity_total',
        'imagesize'   => 400,
        'audioformat' => 'mp32'
    ]);
    $response = @file_get_contents($BASE_URL . '?' . $params2, false, $ctx);
}

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Jamendo API unreachable']);
    exit;
}

$data = json_decode($response, true);

if (!$data || $data['headers']['status'] !== 'success' || empty($data['results'])) {
    // If tag returned no results, retry without tag
    $params3 = http_build_query([
        'client_id'   => $CLIENT_ID,
        'format'      => 'json',
        'limit'       => $limit,
        'offset'      => rand(0, 100),
        'order'       => 'popularity_total',
        'imagesize'   => 400,
        'audioformat' => 'mp32'
    ]);
    $response = @file_get_contents($BASE_URL . '?' . $params3, false, $ctx);
    $data = json_decode($response, true);

    if (!$data || $data['headers']['status'] !== 'success' || empty($data['results'])) {
        http_response_code(404);
        echo json_encode(['error' => 'No tracks found']);
        exit;
    }
}

$tracks = [];
foreach ($data['results'] as $t) {
    $tracks[] = [
        'id'       => 'jamendo-' . $t['id'],
        'title'    => $t['name'],
        'artist'   => $t['artist_name'] . ' (Jamendo)',
        'audio'    => $t['audio'],
        'thumb'    => $t['image'],
        'duration' => (int)$t['duration'],
        'license'  => $t['license_ccurl'] ?? '',
        'shareurl' => $t['shareurl'] ?? ''
    ];
}

echo json_encode($tracks);
