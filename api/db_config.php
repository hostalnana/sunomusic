<?php
define('SP_DB_HOST', 'localhost');
define('SP_DB_NAME', 'elrincondelaflecha');
define('SP_DB_USER', 'reservas');
define('SP_DB_PASS', 'c8a76a3748ba28256fa5c13639d095b4f39d5588');

function getSPConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            "mysql:host=" . SP_DB_HOST . ";dbname=" . SP_DB_NAME . ";charset=utf8mb4",
            SP_DB_USER, SP_DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

// Verificar token de Google y devolver datos del usuario
function verifyGoogleToken($idToken) {
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return null;

    $data = json_decode($response, true);
    if (!$data || empty($data['sub'])) return null;

    return [
        'google_id' => $data['sub'],
        'email' => $data['email'] ?? '',
        'name' => $data['name'] ?? $data['email'] ?? 'Usuario',
        'avatar' => $data['picture'] ?? ''
    ];
}

// Obtener o crear usuario + generar session token
function getOrCreateUser($googleData) {
    $pdo = getSPConnection();

    $stmt = $pdo->prepare("SELECT id, name, email, avatar, session_token FROM sunoplay_users WHERE google_id = ?");
    $stmt->execute([$googleData['google_id']]);
    $user = $stmt->fetch();

    // Generar token de sesión único
    $sessionToken = bin2hex(random_bytes(48));

    if ($user) {
        $pdo->prepare("UPDATE sunoplay_users SET last_login = NOW(), name = ?, avatar = ?, session_token = ? WHERE id = ?")
            ->execute([$googleData['name'], $googleData['avatar'], $sessionToken, $user['id']]);
        $user['session_token'] = $sessionToken;
        return $user;
    }

    $stmt = $pdo->prepare("INSERT INTO sunoplay_users (google_id, email, name, avatar, session_token) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$googleData['google_id'], $googleData['email'], $googleData['name'], $googleData['avatar'], $sessionToken]);

    return [
        'id' => $pdo->lastInsertId(),
        'name' => $googleData['name'],
        'email' => $googleData['email'],
        'avatar' => $googleData['avatar'],
        'session_token' => $sessionToken
    ];
}

// Extraer user_id del header Authorization (usa session token propio, no Google token)
function getAuthUserId() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $token = str_replace('Bearer ', '', $token);

    if (empty($token) || strlen($token) < 20) return null;

    $pdo = getSPConnection();
    $stmt = $pdo->prepare("SELECT id FROM sunoplay_users WHERE session_token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    return $user ? (int)$user['id'] : null;
}
