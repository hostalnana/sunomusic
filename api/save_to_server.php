<?php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'error' => 'No data received']);
    exit;
}

$id = $data['id'];
$title = $data['title'];
$artist = $data['artist'];
$audioUrl = $data['url'];
$thumbUrl = $data['thumb'];
$genre = $data['genre'] ?? 'Otros';

$downloadDir = '../downloads/';
$libFile = $downloadDir . 'library.json';

// Asegurar directorio
if (!is_dir($downloadDir)) {
    mkdir($downloadDir, 0777, true);
}

// Cargar librería
$library = [];
if (file_exists($libFile)) {
    $library = json_decode(file_get_contents($libFile), true) ?: [];
}

// Si la canción ya existe, incrementar corazones
foreach ($library as &$song) {
    if ($song['id'] == $id) {
        $song['hearts'] = ($song['hearts'] ?? 1) + 1;
        file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'message' => 'Heart added', 'song' => $song]);
        exit;
    }
}
unset($song);


// Descargar Audio mediante cURL
$audioExt = pathinfo(parse_url($audioUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'mp3';
$audioName = 'audio_' . md5($id) . '.' . $audioExt;
$audioPath = $downloadDir . $audioName;

$ch = curl_init($audioUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 40);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_REFERER, 'https://www.jamendo.com/');

$audioData = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($audioData === false || $httpCode >= 400) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Source error HTTP ' . $httpCode]);
    exit;
}
file_put_contents($audioPath, $audioData);

// Descargar Thumbnail
$thumbName = 'thumb_' . md5($id) . '.jpg';
$thumbPath = $downloadDir . $thumbName;

$ch = curl_init($thumbUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$thumbData = curl_exec($ch);
curl_close($ch);

if ($thumbData) {
    file_put_contents($thumbPath, $thumbData);
} else {
    $thumbName = '../icon.png';
}

// Actualizar JSON
$newSong = [
    'id' => $id,
    'title' => $title,
    'artist' => $artist,
    'genre' => $genre,
    'hearts' => 1,
    'url' => 'downloads/' . $audioName,
    'thumb' => 'downloads/' . $thumbName,

    'size' => strlen($audioData),
    'savedAt' => time() * 1000
];

array_unshift($library, $newSong);
file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));

echo json_encode(['success' => true, 'song' => $newSong]);
