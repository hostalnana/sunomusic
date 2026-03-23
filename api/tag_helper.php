<?php
/**
 * Genera etiquetas automaticas para una cancion basandose en sus datos.
 * Tipos: fuente (source), genero (genre), estilo (style), decada (decade)
 */
function generateTags($song) {
    $tags = [];

    // 1. Fuente (por ID prefix o genero)
    $id = $song['id'] ?? '';
    $genre = $song['genre'] ?? '';
    $artist = $song['artist'] ?? '';
    $source = $song['source'] ?? '';

    if (str_starts_with($id, 'yt-') || $genre === 'YouTube') {
        $tags[] = 'YouTube';
    } elseif (str_starts_with($id, 'torrent-') || $genre === 'Torrent') {
        $tags[] = 'Torrent';
    } elseif (str_starts_with($id, 'upload-')) {
        $tags[] = 'Subido';
    } elseif (stripos($artist, 'jamendo') !== false || stripos($source, 'jamendo') !== false) {
        $tags[] = 'Jamendo';
    } else {
        $tags[] = 'Suno AI';
    }

    // 2. Genero — dividir generos multi-palabra
    if ($genre && !in_array($genre, ['YouTube', 'Torrent', 'Otros', ''])) {
        $words = preg_split('/[\s,;\/]+/', strtolower($genre));
        foreach ($words as $w) {
            $w = trim($w);
            if (strlen($w) >= 3) {
                $tags[] = ucfirst($w);
            }
        }
    }

    // 3. Decada — si hay info de year
    if (!empty($song['year'])) {
        $decade = floor((int)$song['year'] / 10) * 10;
        $tags[] = $decade . 's';
    }

    // 4. Estilo por keywords en titulo
    $title = strtolower($song['title'] ?? '');
    $styleKeywords = [
        'remix' => 'Remix', 'live' => 'Live', 'acoustic' => 'Acoustic',
        'instrumental' => 'Instrumental', 'cover' => 'Cover', 'demo' => 'Demo',
        'feat' => 'Feat', 'version' => 'Version', 'mix' => 'Mix',
        'unplugged' => 'Unplugged', 'karaoke' => 'Karaoke'
    ];
    foreach ($styleKeywords as $kw => $tag) {
        if (strpos($title, $kw) !== false) {
            $tags[] = $tag;
        }
    }

    return array_values(array_unique($tags));
}
