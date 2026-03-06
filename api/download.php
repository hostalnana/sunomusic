<?php
// Proxy para descargar audio de Jamendo/Suno y devolverlo como blob
// Esto evita problemas de CORS y permite que el visualizador funcione

$audioUrl = isset($_GET['url']) ? $_GET['url'] : '';

if (!$audioUrl) {
    http_response_code(400);
    echo 'Error: No URL provided';
    exit;
}

$parsed = parse_url($audioUrl);
$host = $parsed['host'] ?? '';
$isAllowed = false;

if (str_ends_with($host, 'jamendo.com') || str_ends_with($host, 'suno.ai')) {
    $isAllowed = true;
}

if (!$isAllowed) {
    http_response_code(403);
    echo 'Forbidden: Domain not allowed';
    exit;
}

function fetchAudio($url, $retries = 1) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 45); // Aumentado a 45s
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_REFERER, 'https://www.jamendo.com/');
    
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    
    if (($data === false || $httpCode >= 500) && $retries > 0) {
        usleep(500000); // Esperar 0.5s antes de reintentar
        return fetchAudio($url, $retries - 1);
    }
    
    return [$data, $httpCode, $contentType];
}

list($data, $httpCode, $contentType) = fetchAudio($audioUrl);

if ($data === false || $httpCode >= 400) {
    http_response_code(502);
    echo 'Error: Source returned ' . $httpCode;
    exit;
}

header('Content-Type: ' . ($contentType ?: 'audio/mpeg'));
header('Content-Length: ' . strlen($data));
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=86400');
echo $data;
