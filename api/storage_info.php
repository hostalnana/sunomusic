<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
require_once __DIR__ . '/storage_helper.php';

$action = $_GET['action'] ?? 'info';

switch ($action) {
    case 'cleanup':
        // Clean orphaned files and return result
        $freed = cleanupOrphanedFiles();
        $info = getStorageInfo();
        $info['freed'] = $freed;
        $info['freed_human'] = formatBytes($freed);
        echo json_encode(['success' => true, 'storage' => $info]);
        break;

    case 'info':
    default:
        $info = getStorageInfo();
        // Add human-readable values
        $info['disk_total_human'] = formatBytes($info['disk_total']);
        $info['disk_free_human'] = formatBytes($info['disk_free']);
        $info['library_size_human'] = formatBytes($info['library_size']);
        $info['max_allowed_human'] = formatBytes($info['max_allowed']);
        $info['library_available_human'] = formatBytes($info['library_available']);

        // Count songs in library
        $libFile = DOWNLOADS_DIR . '/library.json';
        $songCount = 0;
        if (file_exists($libFile)) {
            $library = json_decode(file_get_contents($libFile), true) ?: [];
            $songCount = count($library);
        }
        $info['song_count'] = $songCount;

        echo json_encode(['success' => true, 'storage' => $info]);
        break;
}
