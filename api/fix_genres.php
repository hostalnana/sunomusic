<?php
header('Content-Type: application/json');

// Leer biblioteca
$libFile = '/var/www/html/elrincondelaflecha/sunomusic/downloads/library.json';
$library = json_decode(file_get_contents($libFile), true) ?: [];
$fixed = 0;

foreach ($library as $key => $song) {
    $genre = $song['genre'] ?? 'Otros';
    if ($genre === 'Otros' || $genre === 'Sin género' || empty($genre)) {
        $title = strtolower($song['title'] ?? '');
        $newGenre = 'Otros';
        
        if (strpos($title, 'rock') !== false) $newGenre = 'Rock';
        elseif (strpos($title, 'pop') !== false) $newGenre = 'Pop';
        elseif (strpos($title, 'electro') !== false || strpos($title, 'techno') !== false) $newGenre = 'Electrónica';
        elseif (strpos($title, 'jazz') !== false) $newGenre = 'Jazz';
        elseif (strpos($title, 'hip hop') !== false || strpos($title, 'rap') !== false) $newGenre = 'Hip Hop';
        elseif (strpos($title, 'piano') !== false || strpos($title, 'classical') !== false) $newGenre = 'Clásica';
        elseif (strpos($title, 'ambient') !== false || strpos($title, 'chill') !== false) $newGenre = 'Ambient';
        elseif (strpos($title, 'folk') !== false || strpos($title, 'acoustic') !== false) $newGenre = 'Folk';
        elseif (strpos($title, 'metal') !== false) $newGenre = 'Metal';
        elseif (strpos($title, 'dance') !== false) $newGenre = 'Dance';
        elseif (strpos($title, 'indie') !== false) $newGenre = 'Indie';
        elseif (strpos($title, 'soul') !== false) $newGenre = 'Soul';
        elseif (strpos($title, 'funk') !== false) $newGenre = 'Funk';
        elseif (strpos($title, 'blues') !== false) $newGenre = 'Blues';
        elseif (strpos($title, 'reggae') !== false) $newGenre = 'Reggae';
        elseif (strpos($title, 'country') !== false) $newGenre = 'Country';
        elseif (strpos($title, 'latin') !== false || strpos($title, 'salsa') !== false) $newGenre = 'Latino';
        elseif (strpos($title, 'house') !== false) $newGenre = 'House';
        elseif (strpos($title, 'trance') !== false) $newGenre = 'Trance';
        elseif (strpos($title, 'dubstep') !== false) $newGenre = 'Dubstep';
        
        if ($newGenre !== 'Otros') {
            $library[$key]['genre'] = $newGenre;
            $fixed++;
        }
    }
}

file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));

// Contar por género
$byGenre = [];
foreach ($library as $s) {
    $g = $s['genre'] ?? 'Otros';
    $byGenre[$g] = ($byGenre[$g] ?? 0) + 1;
}

echo json_encode(['success' => true, 'fixed' => $fixed, 'byGenre' => $byGenre]);
?>
