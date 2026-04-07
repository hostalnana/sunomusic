<?php
/**
 * Storage management helper for SunoPlay library.
 * Limits library to max 50% of available disk capacity.
 * Auto-cleans orphaned files and lowest-rated songs when needed.
 */

define('STORAGE_MAX_PERCENT', 50); // Max % of total disk that downloads can use
define('DOWNLOADS_DIR', realpath(__DIR__ . '/../downloads') ?: __DIR__ . '/../downloads');
define('LIBRARY_FILE', DOWNLOADS_DIR . '/library.json');

/**
 * Get storage info: library size, disk total, limit, available for library.
 */
function getStorageInfo() {
    $diskTotal = disk_total_space(DOWNLOADS_DIR);
    $diskFree = disk_free_space(DOWNLOADS_DIR);
    $diskUsed = $diskTotal - $diskFree;

    // Calculate library directory size
    $librarySize = getDirectorySize(DOWNLOADS_DIR);

    // Max allowed = 50% of total disk
    $maxAllowed = (int)($diskTotal * STORAGE_MAX_PERCENT / 100);

    return [
        'disk_total' => $diskTotal,
        'disk_free' => $diskFree,
        'disk_used' => $diskUsed,
        'library_size' => $librarySize,
        'max_allowed' => $maxAllowed,
        'library_available' => max(0, $maxAllowed - $librarySize),
        'library_percent' => $diskTotal > 0 ? round($librarySize / $diskTotal * 100, 1) : 0,
        'limit_percent' => STORAGE_MAX_PERCENT,
        'is_full' => $librarySize >= $maxAllowed
    ];
}

/**
 * Check if there's enough space to add a file of $neededBytes.
 * If not, try to free space by cleaning orphans and low-rated songs.
 * Returns true if space is available after cleanup, false otherwise.
 */
function ensureStorageAvailable($neededBytes = 0) {
    $info = getStorageInfo();

    // Already within limits
    if ($info['library_available'] > $neededBytes) {
        return true;
    }

    // Try cleanup: orphaned files first
    $freed = cleanupOrphanedFiles();

    // Re-check after orphan cleanup
    $info = getStorageInfo();
    if ($info['library_available'] > $neededBytes) {
        return true;
    }

    // Still not enough: remove lowest-rated songs until we have space
    $freed += removeLowestRatedSongs($neededBytes - $info['library_available']);

    // Final check
    $info = getStorageInfo();
    return $info['library_available'] > $neededBytes;
}

/**
 * Check storage and return error response if full. Call at the start of save/upload endpoints.
 * Returns null if OK, or a JSON error string if storage is full.
 */
function checkStorageOrFail($neededBytes = 10 * 1024 * 1024) {
    if (!ensureStorageAvailable($neededBytes)) {
        $info = getStorageInfo();
        return json_encode([
            'success' => false,
            'error' => 'Almacenamiento lleno. Biblioteca: ' . formatBytes($info['library_size']) .
                       ' / ' . formatBytes($info['max_allowed']) . ' (limite ' . $info['limit_percent'] . '% del disco). ' .
                       'Elimina canciones para liberar espacio.',
            'storage' => $info
        ]);
    }
    return null;
}

/**
 * Remove files in downloads/ that are NOT referenced in library.json.
 * Skips: library.json itself, yt_jobs/, torrent_jobs/, icon.png
 */
function cleanupOrphanedFiles() {
    if (!file_exists(LIBRARY_FILE)) return 0;

    $library = json_decode(file_get_contents(LIBRARY_FILE), true) ?: [];

    // Build set of referenced files (relative to sunoplay/)
    $referenced = [];
    foreach ($library as $song) {
        if (!empty($song['url'])) {
            // url is like "downloads/audio_xxx.mp3"
            $referenced[basename($song['url'])] = true;
        }
        if (!empty($song['thumb']) && strpos($song['thumb'], 'downloads/') === 0) {
            $referenced[basename($song['thumb'])] = true;
        }
    }

    // Always keep these
    $referenced['library.json'] = true;

    $freed = 0;
    $dir = opendir(DOWNLOADS_DIR);
    if (!$dir) return 0;

    while (($file = readdir($dir)) !== false) {
        if ($file === '.' || $file === '..') continue;

        $path = DOWNLOADS_DIR . '/' . $file;

        // Skip directories (yt_jobs/, torrent_jobs/, etc.)
        if (is_dir($path)) continue;

        // Skip if referenced in library
        if (isset($referenced[$file])) continue;

        // Skip icon.png
        if ($file === 'icon.png') continue;

        // Orphaned file: delete it
        $size = filesize($path);
        if (@unlink($path)) {
            $freed += $size;
        }
    }
    closedir($dir);

    return $freed;
}

/**
 * Remove lowest-rated songs from library until $targetBytes are freed.
 * Songs with lowest hearts are removed first.
 */
function removeLowestRatedSongs($targetBytes) {
    if ($targetBytes <= 0) return 0;
    if (!file_exists(LIBRARY_FILE)) return 0;

    $library = json_decode(file_get_contents(LIBRARY_FILE), true) ?: [];
    if (empty($library)) return 0;

    // Sort by hearts ascending (lowest first = candidates for removal)
    $indexed = [];
    foreach ($library as $i => $song) {
        $indexed[] = ['index' => $i, 'song' => $song, 'hearts' => $song['hearts'] ?? 0];
    }
    usort($indexed, function($a, $b) {
        // Sort by hearts ascending, then by savedAt ascending (oldest first)
        if ($a['hearts'] !== $b['hearts']) return $a['hearts'] - $b['hearts'];
        return ($a['song']['savedAt'] ?? 0) - ($b['song']['savedAt'] ?? 0);
    });

    $freed = 0;
    $toRemove = [];

    foreach ($indexed as $entry) {
        if ($freed >= $targetBytes) break;

        $song = $entry['song'];
        $toRemove[] = $entry['index'];

        // Delete audio file
        $audioFile = DOWNLOADS_DIR . '/' . basename($song['url'] ?? '');
        if (file_exists($audioFile)) {
            $freed += filesize($audioFile);
            @unlink($audioFile);
        }

        // Delete thumbnail (skip icon.png)
        if (!empty($song['thumb']) && strpos($song['thumb'], 'downloads/') === 0) {
            $thumbFile = DOWNLOADS_DIR . '/' . basename($song['thumb']);
            if (file_exists($thumbFile) && !str_contains($thumbFile, 'icon.png')) {
                $freed += filesize($thumbFile);
                @unlink($thumbFile);
            }
        }
    }

    // Remove songs from library array
    if (!empty($toRemove)) {
        $newLibrary = [];
        foreach ($library as $i => $song) {
            if (!in_array($i, $toRemove)) {
                $newLibrary[] = $song;
            }
        }
        file_put_contents(LIBRARY_FILE, json_encode($newLibrary, JSON_PRETTY_PRINT));
    }

    return $freed;
}

/**
 * Get total size of a directory (non-recursive for top-level, recursive for subdirs).
 */
function getDirectorySize($dir) {
    $size = 0;
    if (!is_dir($dir)) return 0;

    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($it as $file) {
        if ($file->isFile()) {
            $size += $file->getSize();
        }
    }
    return $size;
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes($bytes) {
    if ($bytes >= 1073741824) return round($bytes / 1073741824, 1) . ' GB';
    if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}
