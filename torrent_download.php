<?php
header('Content-Type: application/json');

$downloadDir = realpath(__DIR__ . '/../downloads');
$jobDir = $downloadDir . '/torrent_jobs/';
if (!is_dir($jobDir)) mkdir($jobDir, 0777, true);

$aria2 = trim(shell_exec('which aria2c 2>/dev/null'));
$ffmpeg = trim(shell_exec('which ffmpeg 2>/dev/null'));

// === GET ?list — Active downloads ===
if (isset($_GET['list'])) {
    $jobs = [];
    foreach (glob($jobDir . '*/status.json') as $sf) {
        $s = json_decode(file_get_contents($sf), true);
        if ($s && in_array($s['status'] ?? '', ['downloading', 'metadata', 'processing'])) {
            $pid = $s['pid'] ?? 0;
            // Only show jobs with running processes
            if ($pid > 0 && file_exists("/proc/$pid")) {
                $jId = $s['jobId'] ?? basename(dirname($sf));
                $logFile = $jobDir . $jId . '/output.log';
                $progress = 0;
                $downloaded = '';
                $total = '';
                $speed = '';
                $statusText = $s['status'];
                if (file_exists($logFile)) {
                    $log = file_get_contents($logFile);
                    if (strpos($log, '[MEMORY]') !== false && strpos($log, 'Download complete') === false) {
                        $statusText = 'metadata';
                    }
                    if (preg_match_all('/\[#\w+ (\d+(?:\.\d+)?(?:KiB|MiB|GiB))\/(\d+(?:\.\d+)?(?:KiB|MiB|GiB))\((\d+)%\).*?DL:(\d+(?:\.\d+)?(?:KiB|MiB))/s', $log, $matches)) {
                        $last = count($matches[0]) - 1;
                        $downloaded = $matches[1][$last];
                        $total = $matches[2][$last];
                        $progress = (int)$matches[3][$last];
                        $speed = $matches[4][$last] . '/s';
                        $statusText = 'downloading';
                    }
                }
                $jobs[] = [
                    'jobId' => $jId,
                    'title' => $s['title'] ?? 'Unknown',
                    'status' => $statusText,
                    'progress' => $progress,
                    'downloaded' => $downloaded,
                    'total' => $total,
                    'speed' => $speed,
                    'started' => $s['started'] ?? 0
                ];
            }
        }
    }
    echo json_encode(['success' => true, 'jobs' => $jobs]);
    exit;
}

// === GET ?cancel=X — Cancel download ===
if (isset($_GET['cancel'])) {
    $jobId = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['cancel']);
    $jDir = $jobDir . $jobId . '/';
    $statusFile = $jDir . 'status.json';

    if (file_exists($statusFile)) {
        $s = json_decode(file_get_contents($statusFile), true);
        $pid = $s['pid'] ?? 0;
        if ($pid > 0) {
            exec("kill $pid 2>/dev/null");
            // Also kill child processes
            exec("pkill -P $pid 2>/dev/null");
        }
        // Cleanup
        exec("rm -rf " . escapeshellarg($jDir));
        echo json_encode(['success' => true, 'message' => 'Descarga cancelada']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Job no encontrado']);
    }
    exit;
}

// === GET ?jobId=X — Poll status ===
if (isset($_GET['jobId'])) {
    $jobId = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['jobId']);
    $jDir = $jobDir . $jobId . '/';
    $statusFile = $jDir . 'status.json';
    $logFile = $jDir . 'output.log';

    if (!file_exists($statusFile)) {
        echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Job no encontrado']);
        exit;
    }

    $s = json_decode(file_get_contents($statusFile), true);
    $elapsed = time() - ($s['started'] ?? time());

    // Timeout: 10 minutes
    if ($elapsed > 600) {
        $pid = $s['pid'] ?? 0;
        if ($pid > 0) {
            exec("kill $pid 2>/dev/null");
            exec("pkill -P $pid 2>/dev/null");
        }
        exec("rm -rf " . escapeshellarg($jDir));
        echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Timeout (10 min)']);
        exit;
    }

    // Check if aria2c process is still running
    $pid = $s['pid'] ?? 0;
    $running = false;
    if ($pid > 0) {
        $running = file_exists("/proc/$pid");
    }

    // Parse aria2c log for progress
    $progress = 0;
    $downloaded = '';
    $total = '';
    $speed = '';
    $statusText = $s['status'] ?? 'downloading';

    if (file_exists($logFile)) {
        $log = file_get_contents($logFile);

        // Check for metadata resolution
        if (strpos($log, '[MEMORY]') !== false && strpos($log, 'Download complete') === false) {
            $statusText = 'metadata';
        }

        // Parse progress: [#hash XXXMiB/YYYMiB(XX%) CN:N DL:NMiB]
        if (preg_match_all('/\[#\w+ (\d+(?:\.\d+)?(?:KiB|MiB|GiB))\/(\d+(?:\.\d+)?(?:KiB|MiB|GiB))\((\d+)%\).*?DL:(\d+(?:\.\d+)?(?:KiB|MiB))/s', $log, $matches)) {
            $last = count($matches[0]) - 1;
            $downloaded = $matches[1][$last];
            $total = $matches[2][$last];
            $progress = (int)$matches[3][$last];
            $speed = $matches[4][$last];
            $statusText = 'downloading';
        }

        // Check total size limit (500MB)
        if (preg_match('/(\d+(?:\.\d+)?)(GiB)/', $total, $sizeMatch)) {
            $sizeGb = floatval($sizeMatch[1]);
            if ($sizeGb > 0.5) {
                $pid = $s['pid'] ?? 0;
                if ($pid > 0) {
                    exec("kill $pid 2>/dev/null");
                    exec("pkill -P $pid 2>/dev/null");
                }
                exec("rm -rf " . escapeshellarg($jDir));
                echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Torrent demasiado grande (>500MB)']);
                exit;
            }
        }

        // Check for fatal errors (not DHT/routing table errors which are harmless)
        if (!$running && $elapsed > 10) {
            // Only check final status errors, not DHT cache errors
            if (preg_match('/\(RESULT:ERROR\)/', $log) ||
                preg_match('/Download aborted/', $log) ||
                (preg_match('/Status Legend:.*ERROR/', $log) && strpos($log, 'download completed') === false)) {
                $errMsg = 'Descarga fallida';
                if (preg_match('/errorCode=(\d+)/', $log, $ec)) {
                    $errMsg .= " (code {$ec[1]})";
                }
                // Don't cleanup yet if files might exist
                $files = scanDirRecursive($jDir);
                $audioFiles = filterAudioFiles($files);
                if (empty($audioFiles)) {
                    exec("rm -rf " . escapeshellarg($jDir));
                    echo json_encode(['success' => false, 'status' => 'error', 'error' => $errMsg]);
                    exit;
                }
            }
        }

        // Check if download completed (aria2c finished and files exist)
        if (!$running && (strpos($log, 'Download complete') !== false || strpos($log, 'download completed') !== false || $progress >= 100)) {
            // Process audio files
            $result = processCompletedTorrent($jobId, $jDir, $s, $downloadDir, $ffmpeg);
            echo json_encode($result);
            exit;
        }

        // aria2c exited but no completion message — might have failed
        if (!$running && $elapsed > 10) {
            // Check if any files were downloaded
            $files = scanDirRecursive($jDir);
            $audioFiles = filterAudioFiles($files);
            if (!empty($audioFiles)) {
                // Files exist, process them
                $result = processCompletedTorrent($jobId, $jDir, $s, $downloadDir, $ffmpeg);
                echo json_encode($result);
                exit;
            }
            // No files, error
            exec("rm -rf " . escapeshellarg($jDir));
            echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Descarga fallida - no se encontraron archivos']);
            exit;
        }
    }

    echo json_encode([
        'success' => true,
        'status' => $statusText,
        'progress' => $progress,
        'downloaded' => $downloaded,
        'total' => $total,
        'speed' => $speed,
        'elapsed' => $elapsed,
        'title' => $s['title'] ?? ''
    ]);
    exit;
}

// === POST — Start download ===
$data = json_decode(file_get_contents('php://input'), true);
$magnet = $data['magnet'] ?? '';
$title = $data['title'] ?? 'Torrent Audio';

// Validate magnet link
if (!preg_match('/^magnet:\?xt=urn:btih:[a-fA-F0-9]{32,}/i', $magnet)) {
    echo json_encode(['success' => false, 'error' => 'Magnet link no valido']);
    exit;
}

if (!$aria2) {
    echo json_encode(['success' => false, 'error' => 'aria2c no instalado en el servidor']);
    exit;
}

// Check concurrent downloads limit (max 3) and cleanup stale jobs
$activeCount = 0;
foreach (glob($jobDir . '*/status.json') as $sf) {
    $s = json_decode(file_get_contents($sf), true);
    if (in_array($s['status'] ?? '', ['downloading', 'metadata'])) {
        $pid = $s['pid'] ?? 0;
        $elapsed = time() - ($s['started'] ?? 0);
        if ($pid > 0 && file_exists("/proc/$pid")) {
            $activeCount++;
        } elseif ($elapsed > 60) {
            // Stale job: process not running and older than 1 min — cleanup
            $staleDir = dirname($sf);
            exec("rm -rf " . escapeshellarg($staleDir));
        }
    }
}
if ($activeCount >= 3) {
    echo json_encode(['success' => false, 'error' => 'Maximo 3 descargas simultaneas']);
    exit;
}

$jobId = 'torrent_' . uniqid();
$jDir = $jobDir . $jobId . '/';
mkdir($jDir, 0777, true);

$logFile = $jDir . 'output.log';

// Build aria2c command
$trackers = implode(',', [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://explodie.org:6969/announce'
]);

$cmd = sprintf(
    'nohup %s --seed-time=0 --bt-stop-timeout=300 --max-overall-download-limit=5M ' .
    '--file-allocation=none --summary-interval=3 --console-log-level=notice ' .
    '--bt-tracker=%s --dir=%s --max-tries=3 --retry-wait=5 ' .
    '--bt-enable-lpd=true --enable-dht=true --enable-peer-exchange=true ' .
    '%s > %s 2>&1 & echo $!',
    escapeshellarg($aria2),
    escapeshellarg($trackers),
    escapeshellarg($jDir . 'data'),
    escapeshellarg($magnet),
    escapeshellarg($logFile)
);

$pid = trim(shell_exec($cmd));

// Save status
$status = [
    'jobId' => $jobId,
    'status' => 'metadata',
    'started' => time(),
    'title' => mb_substr($title, 0, 200),
    'pid' => (int)$pid,
    'progress' => 0
];
file_put_contents($jDir . 'status.json', json_encode($status));

echo json_encode(['success' => true, 'jobId' => $jobId, 'status' => 'metadata']);
exit;

// === Helper functions ===

function scanDirRecursive($dir) {
    $files = [];
    if (!is_dir($dir)) return $files;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if ($file->isFile()) {
            $files[] = $file->getPathname();
        }
    }
    return $files;
}

function filterAudioFiles($files) {
    $audioExts = ['mp3', 'flac', 'm4a', 'ogg', 'wav', 'aac', 'wma', 'opus', 'ape', 'alac'];
    $audio = [];
    foreach ($files as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, $audioExts) && filesize($f) > 10000) {
            $audio[] = $f;
        }
    }
    // Sort by size descending
    usort($audio, function($a, $b) { return filesize($b) - filesize($a); });
    return $audio;
}

function extractArchives($dir) {
    $archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    $files = scanDirRecursive($dir);
    $extracted = false;

    foreach ($files as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (!in_array($ext, $archiveExts)) continue;

        $extractDir = $dir . '/extracted_' . md5($f);
        mkdir($extractDir, 0777, true);

        switch ($ext) {
            case 'zip':
                exec(sprintf('unzip -o -q %s -d %s 2>/dev/null', escapeshellarg($f), escapeshellarg($extractDir)), $out, $ret);
                if ($ret === 0) $extracted = true;
                break;
            case 'rar':
                $unrar = trim(shell_exec('which unrar 2>/dev/null'));
                if ($unrar) {
                    exec(sprintf('%s x -o+ -y %s %s 2>/dev/null', escapeshellarg($unrar), escapeshellarg($f), escapeshellarg($extractDir . '/')), $out, $ret);
                    if ($ret === 0) $extracted = true;
                }
                break;
            case '7z':
                $sz = trim(shell_exec('which 7z 2>/dev/null'));
                if ($sz) {
                    exec(sprintf('%s x -o%s -y %s 2>/dev/null', escapeshellarg($sz), escapeshellarg($extractDir), escapeshellarg($f)), $out, $ret);
                    if ($ret === 0) $extracted = true;
                }
                break;
            case 'tar':
            case 'gz':
            case 'bz2':
                exec(sprintf('tar xf %s -C %s 2>/dev/null', escapeshellarg($f), escapeshellarg($extractDir)), $out, $ret);
                if ($ret === 0) $extracted = true;
                break;
        }

        // Remove archive after extraction to save space
        if ($extracted) {
            @unlink($f);
        }
    }

    return $extracted;
}

function processCompletedTorrent($jobId, $jDir, $statusData, $downloadDir, $ffmpeg) {
    $dataDir = $jDir . 'data/';

    // Extract any archives (zip, rar, 7z, etc.)
    extractArchives($dataDir);

    $files = scanDirRecursive($dataDir);
    $audioFiles = filterAudioFiles($files);

    if (empty($audioFiles)) {
        // Maybe non-audio torrent, check all files
        exec("rm -rf " . escapeshellarg($jDir));
        return ['success' => false, 'status' => 'error', 'error' => 'No se encontraron archivos de audio en el torrent'];
    }

    $libFile = $downloadDir . '/library.json';
    $library = file_exists($libFile) ? (json_decode(file_get_contents($libFile), true) ?: []) : [];

    $songs = [];
    $maxFiles = 20; // Limit max files to process
    $count = 0;

    foreach ($audioFiles as $audioPath) {
        if ($count >= $maxFiles) break;
        $count++;

        $ext = strtolower(pathinfo($audioPath, PATHINFO_EXTENSION));
        $baseName = pathinfo($audioPath, PATHINFO_FILENAME);

        // Clean up title from filename
        $songTitle = str_replace(['_', '-', '.'], ' ', $baseName);
        $songTitle = preg_replace('/\s+/', ' ', trim($songTitle));
        // Remove common junk from torrent filenames
        $songTitle = preg_replace('/\b(320kbps|256kbps|128kbps|flac|mp3|www\S+|\.com|\.org)\b/i', '', $songTitle);
        $songTitle = trim(preg_replace('/\s+/', ' ', $songTitle));

        // Try to extract artist - title from "Artist - Title" format
        $artist = 'Torrent';
        if (preg_match('/^(.+?)\s*[-–]\s*(.+)$/', $songTitle, $m)) {
            $artist = trim($m[1]);
            $songTitle = trim($m[2]);
        }

        // Convert to MP3 if not already
        $targetPath = $audioPath;
        if ($ext !== 'mp3' && $ffmpeg) {
            $mp3Path = $jDir . $baseName . '.mp3';
            $convertCmd = sprintf(
                '%s -i %s -ab 192k -ar 44100 -y %s 2>/dev/null',
                escapeshellarg($ffmpeg),
                escapeshellarg($audioPath),
                escapeshellarg($mp3Path)
            );
            exec($convertCmd, $output, $retCode);
            if ($retCode === 0 && file_exists($mp3Path) && filesize($mp3Path) > 1000) {
                $targetPath = $mp3Path;
            }
        }

        // Move to downloads with standard naming
        $md5 = md5_file($targetPath);
        $newAudioName = 'audio_' . $md5 . '.mp3';
        $newAudioPath = $downloadDir . '/' . $newAudioName;

        // Skip if already exists
        if (file_exists($newAudioPath)) {
            continue;
        }

        copy($targetPath, $newAudioPath);

        $songId = 'torrent-' . $jobId . ($count > 1 ? '-' . $count : '');
        $newSong = [
            'id' => $songId,
            'title' => mb_substr($songTitle ?: 'Torrent Audio', 0, 150),
            'artist' => mb_substr($artist, 0, 100),
            'genre' => 'Torrent',
            'hearts' => 1,
            'url' => 'downloads/' . $newAudioName,
            'thumb' => 'icon.png',
            'size' => filesize($newAudioPath),
            'savedAt' => time() * 1000
        ];

        array_unshift($library, $newSong);
        $songs[] = $newSong;
    }

    // Save library
    file_put_contents($libFile, json_encode($library, JSON_PRETTY_PRINT));

    // Cleanup torrent job directory
    exec("rm -rf " . escapeshellarg($jDir));

    if (empty($songs)) {
        return ['success' => false, 'status' => 'error', 'error' => 'Los archivos de audio ya existian en la biblioteca'];
    }

    return [
        'success' => true,
        'status' => 'complete',
        'song' => $songs[0],
        'songs' => $songs,
        'totalSongs' => count($songs)
    ];
}
