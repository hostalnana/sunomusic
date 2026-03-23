<?php
header('Content-Type: application/json');
require_once __DIR__ . '/tag_helper.php';

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
        if (!$s) continue;
        $status = $s['status'] ?? '';
        if (!in_array($status, ['downloading', 'metadata', 'processing'])) continue;

        $pid = $s['pid'] ?? 0;
        $jId = $s['jobId'] ?? basename(dirname($sf));
        $jd = $jobDir . $jId . '/';
        $logFile = $jd . 'output.log';
        $progress = 0;
        $downloaded = '';
        $total = '';
        $speed = '';
        $statusText = $status;
        $running = ($pid > 0 && file_exists("/proc/$pid"));

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

        // Show running jobs OR recently dead jobs with files (waiting to be processed)
        if ($running) {
            $jobs[] = [
                'jobId' => $jId, 'title' => $s['title'] ?? 'Unknown',
                'status' => $statusText, 'progress' => $progress,
                'downloaded' => $downloaded, 'total' => $total,
                'speed' => $speed, 'started' => $s['started'] ?? 0
            ];
        } elseif (!$running && (time() - ($s['started'] ?? 0)) < 30) {
            // Just finished — show as processing
            $jobs[] = [
                'jobId' => $jId, 'title' => $s['title'] ?? 'Unknown',
                'status' => 'processing', 'progress' => 100,
                'downloaded' => '', 'total' => '',
                'speed' => '', 'started' => $s['started'] ?? 0
            ];
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
            exec("pkill -P $pid 2>/dev/null");
        }
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

    // Check if aria2c process is still running
    $pid = $s['pid'] ?? 0;
    $running = ($pid > 0 && file_exists("/proc/$pid"));

    // Timeout: 10 minutes — BUT first check if files were downloaded
    if ($elapsed > 600) {
        if (!$running) {
            // Try to process any downloaded files before giving up
            $dataDir = $jDir . 'data/';
            $files = scanDirRecursive($dataDir);
            extractArchives($dataDir, $s['title'] ?? '');
            $files = scanDirRecursive($dataDir);
            $audioFiles = filterAudioFiles($files);
            if (!empty($audioFiles)) {
                $result = processCompletedTorrent($jobId, $jDir, $s, $downloadDir, $ffmpeg);
                echo json_encode($result);
                exit;
            }
        }
        if ($pid > 0) {
            exec("kill $pid 2>/dev/null");
            exec("pkill -P $pid 2>/dev/null");
        }
        exec("rm -rf " . escapeshellarg($jDir));
        echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Timeout (10 min)']);
        exit;
    }

    // Parse aria2c log for progress
    $progress = 0;
    $downloaded = '';
    $total = '';
    $speed = '';
    $statusText = $s['status'] ?? 'downloading';

    $log = '';
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
                if ($pid > 0) {
                    exec("kill $pid 2>/dev/null");
                    exec("pkill -P $pid 2>/dev/null");
                }
                exec("rm -rf " . escapeshellarg($jDir));
                echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Torrent demasiado grande (>500MB)']);
                exit;
            }
        }
    }

    // === Process if aria2c has finished ===
    if (!$running && $elapsed > 5) {
        $dataDir = $jDir . 'data/';

        // Check for completion in log
        $logComplete = (!empty($log) && (strpos($log, 'Download complete') !== false || strpos($log, 'download completed') !== false || $progress >= 100));

        // Check for files on disk (works even if log is empty)
        $files = scanDirRecursive($dataDir);
        $hasArchives = false;
        $archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
        foreach ($files as $f) {
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $archiveExts) && filesize($f) > 1000) {
                $hasArchives = true;
                break;
            }
        }

        // Extract archives with password from title
        if ($hasArchives) {
            extractArchives($dataDir, $s['title'] ?? '');
            $files = scanDirRecursive($dataDir);
        }

        $audioFiles = filterAudioFiles($files);

        if (!empty($audioFiles)) {
            // Files found — process regardless of log content
            $result = processCompletedTorrent($jobId, $jDir, $s, $downloadDir, $ffmpeg);
            echo json_encode($result);
            exit;
        }

        // Check for errors in log
        if (!empty($log)) {
            if (preg_match('/\(RESULT:ERROR\)/', $log) ||
                preg_match('/Download aborted/', $log) ||
                (preg_match('/Status Legend:.*ERROR/', $log) && strpos($log, 'download completed') === false)) {
                $errMsg = 'Descarga fallida';
                if (preg_match('/errorCode=(\d+)/', $log, $ec)) {
                    $errMsg .= " (code {$ec[1]})";
                }
                exec("rm -rf " . escapeshellarg($jDir));
                echo json_encode(['success' => false, 'status' => 'error', 'error' => $errMsg]);
                exit;
            }
        }

        // No log, no files, process dead, elapsed > 30s — definitely failed
        if (empty($log) && empty($files) && $elapsed > 30) {
            exec("rm -rf " . escapeshellarg($jDir));
            echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Descarga fallida - sin log ni archivos']);
            exit;
        }

        // Archives found but no audio after extraction
        if ($hasArchives && empty($audioFiles)) {
            // Might be password-protected — report to user
            $passwords = extractPasswordsFromTitle($s['title'] ?? '');
            $msg = 'Archivos comprimidos sin audio';
            if (empty($passwords)) {
                $msg .= ' (posible password requerido)';
            } else {
                $msg .= ' (passwords probados: ' . implode(', ', $passwords) . ')';
            }
            exec("rm -rf " . escapeshellarg($jDir));
            echo json_encode(['success' => false, 'status' => 'error', 'error' => $msg]);
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
            // Stale job: try to process files, then cleanup
            $staleDir = dirname($sf) . '/';
            $staleDataDir = $staleDir . 'data/';
            extractArchives($staleDataDir, $s['title'] ?? '');
            $staleFiles = scanDirRecursive($staleDataDir);
            $staleAudio = filterAudioFiles($staleFiles);
            if (!empty($staleAudio)) {
                processCompletedTorrent($s['jobId'] ?? basename(dirname($sf)), $staleDir, $s, $downloadDir, $ffmpeg);
            } else {
                exec("rm -rf " . escapeshellarg($staleDir));
            }
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

// Create empty log file first (ensures redirect target exists)
touch($logFile);
chmod($logFile, 0666);

// Build aria2c command — use bash -c for reliable stdout/stderr redirect
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

$aria2Cmd = sprintf(
    '%s --seed-time=0 --bt-stop-timeout=300 --max-overall-download-limit=5M ' .
    '--file-allocation=none --summary-interval=3 --console-log-level=notice ' .
    '--bt-tracker=%s --dir=%s --max-tries=3 --retry-wait=5 ' .
    '--bt-enable-lpd=true --enable-dht=true --enable-peer-exchange=true ' .
    '%s',
    escapeshellarg($aria2),
    escapeshellarg($trackers),
    escapeshellarg($jDir . 'data'),
    escapeshellarg($magnet)
);

// Use bash -c to ensure proper redirection even with special chars
$cmd = sprintf(
    'nohup bash -c %s > %s 2>&1 & echo $!',
    escapeshellarg($aria2Cmd),
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
    usort($audio, function($a, $b) { return filesize($b) - filesize($a); });
    return $audio;
}

/**
 * Extract possible passwords from torrent title.
 * Common patterns: "pass: xxx", "password=xxx", "[pass xxx]", "(pass xxx)", "contraseña: xxx"
 */
function extractPasswordsFromTitle($title) {
    $passwords = [];
    // Pattern: pass: xxx, password: xxx, pass=xxx, contraseña: xxx
    if (preg_match('/(?:pass(?:word)?|contraseña|clave)\s*[:=]\s*([^\s\]\)]+)/ui', $title, $m)) {
        $passwords[] = trim($m[1], '.,;!');
    }
    // Pattern: [pass xxx] or (pass xxx) or {pass xxx}
    if (preg_match('/[\[\(\{](?:pass(?:word)?|pw)\s+([^\]\)\}]+)[\]\)\}]/ui', $title, $m)) {
        $passwords[] = trim($m[1]);
    }
    // Pattern: "www.something.com" as password (very common in scene releases)
    if (preg_match('/(www\.\S+\.\w{2,4})/i', $title, $m)) {
        $passwords[] = $m[1];
    }
    // Pattern: standalone URL-like password at end
    if (preg_match('/\b(\w+\.\w{2,4})\s*$/i', $title, $m)) {
        $pw = $m[1];
        if (strpos($pw, '.') !== false && !in_array(strtolower($pw), ['mp3', 'flac', 'wav'])) {
            $passwords[] = $pw;
        }
    }
    return array_unique($passwords);
}

function extractArchives($dir, $torrentTitle = '') {
    $archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    $files = scanDirRecursive($dir);
    $extracted = false;

    // Collect passwords: from title + from .txt/.nfo files in the torrent
    $passwords = extractPasswordsFromTitle($torrentTitle);

    // Also look for .txt and .nfo files that might contain passwords
    foreach ($files as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, ['txt', 'nfo']) && filesize($f) < 10000) {
            $content = @file_get_contents($f);
            if ($content) {
                $txtPasswords = extractPasswordsFromTitle($content);
                $passwords = array_merge($passwords, $txtPasswords);
            }
        }
    }
    $passwords = array_unique($passwords);

    foreach ($files as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (!in_array($ext, $archiveExts)) continue;
        if (filesize($f) < 1000) continue;

        $extractDir = $dir . '/extracted_' . md5($f);
        @mkdir($extractDir, 0777, true);

        $ok = false;

        switch ($ext) {
            case 'zip':
                // Try without password first
                exec(sprintf('unzip -o -q %s -d %s 2>&1', escapeshellarg($f), escapeshellarg($extractDir)), $out, $ret);
                if ($ret === 0) { $ok = true; break; }
                // Try with passwords
                foreach ($passwords as $pw) {
                    $out = [];
                    exec(sprintf('unzip -o -q -P %s %s -d %s 2>&1', escapeshellarg($pw), escapeshellarg($f), escapeshellarg($extractDir)), $out, $ret);
                    if ($ret === 0) { $ok = true; break; }
                }
                break;

            case 'rar':
                $unrar = trim(shell_exec('which unrar 2>/dev/null'));
                if (!$unrar) break;
                // Try without password
                exec(sprintf('%s x -o+ -y %s %s 2>&1', escapeshellarg($unrar), escapeshellarg($f), escapeshellarg($extractDir . '/')), $out, $ret);
                if ($ret === 0) { $ok = true; break; }
                // Try with passwords
                foreach ($passwords as $pw) {
                    $out = [];
                    exec(sprintf('%s x -o+ -y -p%s %s %s 2>&1', escapeshellarg($unrar), escapeshellarg($pw), escapeshellarg($f), escapeshellarg($extractDir . '/')), $out, $ret);
                    if ($ret === 0) { $ok = true; break; }
                }
                break;

            case '7z':
                $sz = trim(shell_exec('which 7z 2>/dev/null'));
                if (!$sz) break;
                // Try without password
                exec(sprintf('%s x -o%s -y %s 2>&1', escapeshellarg($sz), escapeshellarg($extractDir), escapeshellarg($f)), $out, $ret);
                if ($ret === 0) { $ok = true; break; }
                // Try with passwords
                foreach ($passwords as $pw) {
                    $out = [];
                    exec(sprintf('%s x -o%s -y -p%s %s 2>&1', escapeshellarg($sz), escapeshellarg($extractDir), escapeshellarg($pw), escapeshellarg($f)), $out, $ret);
                    if ($ret === 0) { $ok = true; break; }
                }
                break;

            case 'tar':
            case 'gz':
            case 'bz2':
                exec(sprintf('tar xf %s -C %s 2>&1', escapeshellarg($f), escapeshellarg($extractDir)), $out, $ret);
                if ($ret === 0) $ok = true;
                break;
        }

        if ($ok) {
            $extracted = true;
            @unlink($f);
        }
    }

    return $extracted;
}

function processCompletedTorrent($jobId, $jDir, $statusData, $downloadDir, $ffmpeg) {
    $dataDir = $jDir . 'data/';

    // Extract any archives (zip, rar, 7z, etc.) with password support
    extractArchives($dataDir, $statusData['title'] ?? '');

    $files = scanDirRecursive($dataDir);
    $audioFiles = filterAudioFiles($files);

    if (empty($audioFiles)) {
        exec("rm -rf " . escapeshellarg($jDir));
        return ['success' => false, 'status' => 'error', 'error' => 'No se encontraron archivos de audio en el torrent'];
    }

    $libFile = $downloadDir . '/library.json';
    // Ensure library.json is writable by www-data
    if (file_exists($libFile) && !is_writable($libFile)) {
        @chmod($libFile, 0664);
    }
    $library = file_exists($libFile) ? (json_decode(file_get_contents($libFile), true) ?: []) : [];

    // Try to extract cover art
    $coverThumb = 'icon.png';
    foreach ($files as $f) {
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp']) && filesize($f) > 5000) {
            $md5cover = md5_file($f);
            $coverName = 'thumb_' . $md5cover . '.' . $ext;
            $coverDest = $downloadDir . '/' . $coverName;
            if (!file_exists($coverDest)) copy($f, $coverDest);
            $coverThumb = 'downloads/' . $coverName;
            break;
        }
    }

    // Try to extract artist from parent folder name
    $folderArtist = '';
    $parentDir = '';
    foreach ($audioFiles as $af) {
        $relPath = str_replace($dataDir, '', $af);
        $parts = explode('/', $relPath);
        if (count($parts) > 1) {
            $parentDir = $parts[0];
            // "Artist - Album" pattern in folder name
            if (preg_match('/^(.+?)\s*[-–]\s*(.+)$/', $parentDir, $m)) {
                $folderArtist = trim($m[1]);
            }
            break;
        }
    }

    $songs = [];
    $maxFiles = 30;
    $count = 0;

    // Sort audio files by name for proper track ordering
    usort($audioFiles, function($a, $b) {
        return strnatcasecmp(basename($a), basename($b));
    });

    foreach ($audioFiles as $audioPath) {
        if ($count >= $maxFiles) break;
        $count++;

        $ext = strtolower(pathinfo($audioPath, PATHINFO_EXTENSION));
        $baseName = pathinfo($audioPath, PATHINFO_FILENAME);

        // Clean up title from filename
        $songTitle = str_replace(['_', '-', '.'], ' ', $baseName);
        $songTitle = preg_replace('/\s+/', ' ', trim($songTitle));
        // Remove common junk
        $songTitle = preg_replace('/\b(320kbps|256kbps|128kbps|192kbps|flac|mp3|www\S+|\.com|\.org|v0|v2|cbr|vbr)\b/i', '', $songTitle);
        // Remove leading track numbers like "01 ", "01. ", "1 - "
        $songTitle = preg_replace('/^\d{1,3}[\s.\-]+/', '', $songTitle);
        $songTitle = trim(preg_replace('/\s+/', ' ', $songTitle));

        // Extract artist from filename
        $artist = $folderArtist ?: 'Torrent';
        if (preg_match('/^(.+?)\s*[-–]\s*(.+)$/', $songTitle, $m)) {
            $artist = trim($m[1]);
            $songTitle = trim($m[2]);
        }

        // Convert to MP3 if not already
        $targetPath = $audioPath;
        if ($ext !== 'mp3' && $ffmpeg) {
            $mp3Path = $jDir . 'convert_' . $count . '.mp3';
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

        // Move to downloads
        $md5 = md5_file($targetPath);
        $newAudioName = 'audio_' . $md5 . '.mp3';
        $newAudioPath = $downloadDir . '/' . $newAudioName;

        if (file_exists($newAudioPath)) continue;

        copy($targetPath, $newAudioPath);

        $songId = 'torrent-' . $jobId . ($count > 1 ? '-' . $count : '');
        $newSong = [
            'id' => $songId,
            'title' => mb_substr($songTitle ?: 'Torrent Audio', 0, 150),
            'artist' => mb_substr($artist, 0, 100),
            'genre' => 'Torrent',
            'hearts' => 1,
            'url' => 'downloads/' . $newAudioName,
            'thumb' => $coverThumb,
            'size' => filesize($newAudioPath),
            'savedAt' => time() * 1000
        ];

        $newSong['tags'] = generateTags($newSong);
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
