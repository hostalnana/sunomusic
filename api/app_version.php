<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo json_encode([
    'version_code' => 12,
    'version_name' => '3.4.0',
    'apk_url' => 'https://app.lomastrend.com/sunoplay/chemplay-v3.4.0.apk',
    'changelog' => "Dislike inteligente: si una cancion llega a -1 corazones se elimina de la cola y salta.\nBoton Al Azar: salta a cancion aleatoria de la cola.\nBoton Sorpresa: mezcla toda la biblioteca al azar.\nCorazones visibles en Android Auto, notificacion y pantalla bloqueada.",
    'force_update' => false
]);
