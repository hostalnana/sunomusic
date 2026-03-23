<?php
header('Content-Type: application/json; charset=utf-8');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = min((int)($_GET['limit'] ?? 10), 20);

if (strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

$results = [];
$ctx = stream_context_create([
    'http' => [
        'timeout' => 10,
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36\r\n"
    ]
]);

// Strategy 1: TPB API (apibay.org) - Music category 101
$apiUrl = 'https://apibay.org/q.php?q=' . urlencode($q) . '&cat=101';
$apiResp = @file_get_contents($apiUrl, false, $ctx);

if ($apiResp) {
    $data = @json_decode($apiResp, true);
    if ($data && is_array($data)) {
        // Filter out invalid entries first
        $valid = array_filter($data, function($item) {
            return !empty($item['name']) && ($item['id'] ?? '0') !== '0';
        });
        // Sort by seeders descending (most available first)
        usort($valid, function($a, $b) {
            return (int)($b['seeders'] ?? 0) - (int)($a['seeders'] ?? 0);
        });
        foreach (array_slice($valid, 0, $limit) as $item) {
            $results[] = [
                'title' => $item['name'],
                'magnet' => 'magnet:?xt=urn:btih:' . $item['info_hash'] .
                            '&dn=' . urlencode($item['name']) .
                            '&tr=udp://tracker.opentrackr.org:1337/announce' .
                            '&tr=udp://open.stealth.si:80/announce' .
                            '&tr=udp://tracker.openbittorrent.com:6969/announce',
                'size' => formatBytes((int)$item['size']),
                'seeders' => (int)($item['seeders'] ?? 0),
                'leechers' => (int)($item['leechers'] ?? 0),
                'source' => 'TPB'
            ];
        }
    }
}

// Strategy 2: Fallback - 1337x.to scraping
if (empty($results)) {
    $searchUrl = 'https://1337x.to/category-search/' . urlencode($q) . '/Music/1/';
    $html = @file_get_contents($searchUrl, false, $ctx);

    if ($html) {
        // Extract torrent links and titles
        if (preg_match_all('/<td class="coll-1 name">.*?<a href="(\/torrent\/[^"]+)"[^>]*>([^<]+)<\/a>/s', $html, $matches, PREG_SET_ORDER)) {
            $count = 0;
            foreach ($matches as $match) {
                if ($count >= $limit) break;
                $detailUrl = 'https://1337x.to' . $match[1];
                $title = html_entity_decode(trim($match[2]));

                // Fetch detail page for magnet link
                $detailHtml = @file_get_contents($detailUrl, false, $ctx);
                if ($detailHtml && preg_match('/href="(magnet:\?[^"]+)"/i', $detailHtml, $magMatch)) {
                    $results[] = [
                        'title' => $title,
                        'magnet' => html_entity_decode($magMatch[1]),
                        'size' => '',
                        'seeders' => 0,
                        'source' => '1337x'
                    ];
                    $count++;
                }
            }
        }
    }
}

echo json_encode($results);

function formatBytes($bytes) {
    if ($bytes <= 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB'];
    $i = 0;
    while ($bytes >= 1024 && $i < 3) { $bytes /= 1024; $i++; }
    return round($bytes, 1) . ' ' . $units[$i];
}
