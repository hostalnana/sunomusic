<?php
header('Content-Type: application/json');
$libFile = '../downloads/library.json';

if (file_exists($libFile)) {
    echo file_get_contents($libFile);
} else {
    echo json_encode([]);
}
