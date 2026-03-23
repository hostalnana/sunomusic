<?php
header('Content-Type: application/json');
require_once __DIR__ . '/tag_helper.php';

$allowedMimes = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/aac',
                 'audio/x-m4a', 'audio/mp3', 'audio/x-wav', 'audio/webm', 'application/octet-stream'];
$maxSize = 50 * 1024 * 1024; // 50MB

// Check for file upload
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    $err = $_FILES['audio']['error'] ?? 'no file';
    echo json_encode(['success' => false, 'error' => 'No audio file received (err: ' . $err . ')']);
    exit;
}

$file = $_FILES['audio'];

// Validate size
if ($file['size'] > $maxSize) {
    echo json_encode(['success' => false, 'error' => 'File too large (max 50MB)']);
    exit;
}

// Validate MIME
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowedMimes)) {
    echo json_encode(['success' => false, 'error' => 'Invalid audio format: ' . $mime]);
    exit;
}

$downloadDir = __DIR__ . '/../downloads/';
$libFile = $downloadDir . 'library.json';

// Generate ID and title from filename
$originalName = $file['name'];
$title = pathinfo($originalName, PATHINFO_FILENAME);
$title = str_replace(['_', '-', '.'], ' ', $title);
$title = preg_replace('/\s+/', ' ', trim($title));
$title = mb_substr($title, 0, 100);

$id = 'upload-' . uniqid();
$md5 = md5($id . $originalName);

// Determine extension
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) ?: 'mp3';
if (!in_array($ext, ['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac', 'webm'])) $ext = 'mp3';

// Convert to MP3 if not already and ffmpeg is available
$audioName = 'audio_' . $md5 . '.mp3';
$audioPath = $downloadDir . $audioName;

if ($ext !== 'mp3' && file_exists('/usr/bin/ffmpeg')) {
    $tmpInput = $file['tmp_name'];
    $cmd = sprintf('ffmpeg -i %s -vn -acodec libmp3lame -q:a 2 %s 2>&1',
        escapeshellarg($tmpInput), escapeshellarg($audioPath));
    exec($cmd, $output, $returnCode);
    if ($returnCode !== 0) {
        // Fallback: save as original format
        $audioName = 'audio_' . $md5 . '.' . $ext;
        $audioPath = $downloadDir . $audioName;
        move_uploaded_file($file['tmp_name'], $audioPath);
    }
} else {
    if ($ext !== 'mp3') {
        $audioName = 'audio_' . $md5 . '.' . $ext;
        $audioPath = $downloadDir . $audioName;
    }
    move_uploaded_file($file['tmp_name'], $audioPath);
}

if (!file_exists($audioPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save audio file']);
    exit;
}

$fileSize = filesize($audioPath);

// Load library
$library = [];
if (file_exists($libFile)) {
    $library = json_decode(file_get_contents($libFile), true) ?: [];
}

// Add to library
$newSong = [
    'id' => $id,
    'title' => $title,
    'artist' => 'Compartido',
    'genre' => 'Otros',
    'hearts' => 1,
    'url' => 'downloads/' . $audioName,
    'thumb' => 'icon.png',
    'size' => $fileSize,
    'savedAt' => time() * 1000
];

$newSong['tags'] = generateTags($newSong);
array_unshift($library, $newSong);
file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));

echo json_encode(['success' => true, 'song' => $newSong]);
