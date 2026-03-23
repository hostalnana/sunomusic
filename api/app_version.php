<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo json_encode([
    'version_code' => 10,
    'version_name' => '3.2.0',
    'apk_url' => 'https://app.lomastrend.com/sunoplay/chemplay-v3.2.0.apk',
    'changelog' => "Musica sigue sonando con pantalla apagada.\nControles en pantalla de bloqueo (play/pausa/siguiente/anterior).\nReanudacion automatica tras llamadas o notificaciones.\nCorreccion de errores de reproduccion silenciosa.",
    'force_update' => false
]);
