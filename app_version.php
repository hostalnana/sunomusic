<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo json_encode([
    'version_code' => 4,
    'version_name' => '1.3.0',
    'apk_url' => 'https://app.lomastrend.com/sunoplay/sunoplay-v1.3.0.apk',
    'changelog' => 'Compartir canciones y links de YouTube. Busqueda en red torrent. Mejoras generales.',
    'force_update' => false
]);
