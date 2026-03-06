<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$CLIPS_FILE = __DIR__ . '/suno_clips.json';
$CDN_BASE = 'https://cdn1.suno.ai/';

// Load clips database
$clipsData = json_decode(file_get_contents($CLIPS_FILE), true);
if (!$clipsData) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load clips database']);
    exit;
}

$tag = isset($_GET['tag']) ? strtolower(trim($_GET['tag'])) : '';
$limit = min(max((int)($_GET['limit'] ?? 5), 1), 20);

// Strategy 1: exact genre match
$matchedClips = [];
if ($tag && isset($clipsData[$tag])) {
    $matchedClips = $clipsData[$tag];
}

// Strategy 2: partial match (genre contains the tag word)
if (empty($matchedClips) && $tag) {
    foreach ($clipsData as $genre => $clips) {
        if (strpos($genre, $tag) !== false) {
            $matchedClips = array_merge($matchedClips, $clips);
        }
        if (count($matchedClips) >= 50) break;
    }
}

// Strategy 3: random genre if no tag or no match
if (empty($matchedClips)) {
    $genres = array_keys($clipsData);
    $randomGenre = $genres[array_rand($genres)];
    $matchedClips = $clipsData[$randomGenre];
    $tag = $randomGenre;
}

// Deduplicate by title (keep one version per song)
$seen = [];
$unique = [];
foreach ($matchedClips as $clip) {
    $cleanTitle = preg_replace('/ v[12]$/', '', $clip['title'] ?? '');
    if (!isset($seen[$cleanTitle])) {
        $seen[$cleanTitle] = true;
        $unique[] = $clip;
    }
}

// Shuffle and limit
shuffle($unique);
$selected = array_slice($unique, 0, $limit);

// Build response
$tracks = [];
foreach ($selected as $clip) {
    $tracks[] = [
        'id'     => 'suno-' . $clip['id'],
        'title'  => $clip['title'] ?? 'Suno AI Track',
        'artist' => 'Suno AI',
        'audio'  => $CDN_BASE . $clip['id'] . '.mp3',
        'thumb'  => 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500',
        'genre'  => $tag,
        'source' => 'suno'
    ];
}

echo json_encode($tracks);
