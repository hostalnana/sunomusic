<?php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'] ?? '';

if (!$id) {
    echo json_encode(['success' => false]);
    exit;
}

$libFile = '../downloads/library.json';
if (!file_exists($libFile)) {
    echo json_encode(['success' => true]);
    exit;
}

$library = json_decode(file_get_contents($libFile), true) ?: [];
$newLibrary = [];
$toDelete = [];

foreach ($library as $song) {
    if ($song['id'] == $id) {
        $toDelete[] = '../' . $song['url'];
        $toDelete[] = '../' . $song['thumb'];
    } else {
        $newLibrary[] = $song;
    }
}

file_put_contents($libFile, json_encode($newLibrary, JSON_PRETTY_PRINT));

// Clean files
foreach ($toDelete as $f) {
    if (file_exists($f) && !str_contains($f, 'icon.png')) {
        @unlink($f);
    }
}

echo json_encode(['success' => true]);
