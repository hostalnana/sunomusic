<?php
header('Content-Type: application/json');
require_once __DIR__ . '/tag_helper.php';

$downloadDir = realpath(__DIR__ . '/../downloads');
$jobDir = $downloadDir . '/yt_jobs/';
if (!is_dir($jobDir)) mkdir($jobDir, 0777, true);

// Mode 2: Check status (GET ?jobId=X)
if (isset($_GET['jobId'])) {
    $jobId = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['jobId']);
    $outputFile = $jobDir . $jobId . '_output.json';
    $statusFile = $jobDir . $jobId . '.json';

    // Find the final MP3 file (NOT intermediate webm/m4a which means conversion is in progress)
    $mp3File = null;
    $hasIntermediate = false;
    foreach (glob($downloadDir . '/yt_' . $jobId . '.*') as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, ['webm', 'm4a', 'opus', 'ogg', 'wav'])) {
            $hasIntermediate = true; // yt-dlp still converting
        }
        if ($ext === 'mp3') {
            $mp3File = $f;
        }
    }

    // Only process when: MP3 exists AND no intermediate files (conversion done)
    // AND output JSON has valid data (yt-dlp writes JSON only after completion)
    $jsonReady = false;
    $meta = ['title' => 'YouTube Audio', 'artist' => 'YouTube', 'thumb_url' => ''];
    if (file_exists($outputFile)) {
        $raw = file_get_contents($outputFile);
        if (preg_match('/\{[^{}]*"title"[^{}]*\}/s', $raw, $jsonMatch)) {
            $json = @json_decode($jsonMatch[0], true);
        } else {
            $json = @json_decode($raw, true);
        }
        if ($json && !empty($json['title'])) {
            $jsonReady = true;
            $meta['title'] = $json['title'] ?? $json['fulltitle'] ?? 'YouTube Audio';
            $meta['artist'] = $json['uploader'] ?? $json['channel'] ?? $json['artist'] ?? 'YouTube';
            $meta['thumb_url'] = $json['thumbnail'] ?? '';
        }
    }

    if ($mp3File && file_exists($mp3File) && filesize($mp3File) > 10000 && !$hasIntermediate && $jsonReady) {
        // Download and conversion complete — process into library

        // Move to standard naming
        $md5 = md5_file($mp3File);
        $newAudioName = 'audio_' . $md5 . '.mp3';
        $newAudioPath = $downloadDir . '/' . $newAudioName;
        rename($mp3File, $newAudioPath);

        // Download thumbnail
        $thumbName = 'icon.png';
        if (!empty($meta['thumb_url'])) {
            $thumbFile = 'thumb_' . $md5 . '.jpg';
            $thumbPath = $downloadDir . '/' . $thumbFile;
            $ch = curl_init($meta['thumb_url']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $thumbData = curl_exec($ch);
            curl_close($ch);
            if ($thumbData && strlen($thumbData) > 100) {
                file_put_contents($thumbPath, $thumbData);
                $thumbName = 'downloads/' . $thumbFile;
            }
        }

        // Add to library.json
        $libFile = $downloadDir . '/library.json';
        if (file_exists($libFile) && !is_writable($libFile)) {
            @chmod($libFile, 0664);
        }
        $library = file_exists($libFile) ? (json_decode(file_get_contents($libFile), true) ?: []) : [];

        $id = 'yt-' . $jobId;
        $newSong = [
            'id' => $id,
            'title' => mb_substr($meta['title'], 0, 150),
            'artist' => mb_substr($meta['artist'], 0, 100),
            'genre' => 'YouTube',
            'hearts' => 1,
            'url' => 'downloads/' . $newAudioName,
            'thumb' => $thumbName,
            'size' => filesize($newAudioPath),
            'savedAt' => time() * 1000
        ];

        $newSong['tags'] = generateTags($newSong);
        array_unshift($library, $newSong);
        file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));

        // Cleanup all job files (including any leftover intermediates)
        @unlink($outputFile);
        @unlink($statusFile);
        foreach (glob($downloadDir . '/yt_' . $jobId . '.*') as $f) {
            @unlink($f);
        }

        echo json_encode(['success' => true, 'status' => 'complete', 'song' => $newSong]);
        exit;
    }

    // Check if process is still running or failed
    if (file_exists($statusFile)) {
        $status = json_decode(file_get_contents($statusFile), true);
        $elapsed = time() - ($status['started'] ?? time());

        // Check if yt-dlp process finished with error
        if (file_exists($outputFile) && $elapsed > 5) {
            $raw = file_get_contents($outputFile);
            if (stripos($raw, 'ERROR') !== false && !$mp3File) {
                @unlink($outputFile);
                @unlink($statusFile);
                echo json_encode(['success' => false, 'status' => 'error', 'error' => 'No se pudo descargar el video']);
                exit;
            }
        }

        // Timeout after 3 minutes
        if ($elapsed > 180) {
            @unlink($outputFile);
            @unlink($statusFile);
            echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Timeout']);
            exit;
        }

        echo json_encode(['success' => true, 'status' => 'downloading', 'elapsed' => $elapsed]);
        exit;
    }

    echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Job not found']);
    exit;
}

// Mode 1: Start download (POST {url})
$data = json_decode(file_get_contents('php://input'), true);
$url = $data['url'] ?? '';

// Validate YouTube URL
if (!preg_match('/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|m\.youtube\.com)\//i', $url)) {
    echo json_encode(['success' => false, 'error' => 'URL de YouTube no válida']);
    exit;
}

// Check yt-dlp is available
$ytdlp = trim(shell_exec('which yt-dlp 2>/dev/null'));
if (!$ytdlp) {
    echo json_encode(['success' => false, 'error' => 'yt-dlp no instalado en el servidor']);
    exit;
}

$jobId = 'yt_' . uniqid();
$outputTemplate = $downloadDir . '/yt_' . $jobId . '.%(ext)s';
$outputJson = $jobDir . $jobId . '_output.json';

// Start yt-dlp in background
$cmd = sprintf(
    'nohup %s -x --audio-format mp3 --audio-quality 2 --no-playlist --max-filesize 50m ' .
    '--no-warnings --print-json -o %s %s > %s 2>&1 &',
    escapeshellarg($ytdlp),
    escapeshellarg($outputTemplate),
    escapeshellarg($url),
    escapeshellarg($outputJson)
);

exec($cmd);

// Save status
file_put_contents($jobDir . $jobId . '.json', json_encode(['status' => 'downloading', 'started' => time()]));

echo json_encode(['success' => true, 'jobId' => $jobId, 'status' => 'downloading']);
