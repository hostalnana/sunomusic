<?php
// Handle POST from GSI redirect mode (fallback)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['credential'])) {
    require_once 'db_config.php';
    $googleData = verifyGoogleToken($_POST['credential']);
    if ($googleData) {
        $user = getOrCreateUser($googleData);
        $params = http_build_query([
            'token' => $user['session_token'],
            'name' => $user['name'],
            'email' => $user['email'],
            'avatar' => $user['avatar'],
            'id' => $user['id']
        ]);
        // Output redirect page
        echo '<!DOCTYPE html><html><body><script>window.location.href="sunoplay://auth?' . addslashes($params) . '";</script></body></html>';
        exit;
    }
}
// For GET requests (OAuth implicit flow): Google returns id_token in URL hash fragment
// PHP can't read hash fragments, so we serve JS that reads it and processes it
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Suno Play - Procesando...</title>
    <style>
        body { background:#050507; color:#fff; font-family:sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; text-align:center; }
        .spinner { width:40px; height:40px; border:3px solid #333; border-top-color:#8b5cf6; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        a { color:#8b5cf6; text-decoration:none; }
        .msg { font-size:16px; margin-bottom:8px; }
        .sub { color:#888; font-size:14px; }
        .manual-link { margin-top:24px; display:none; }
    </style>
</head>
<body>
    <div>
        <div class="spinner" id="spinner"></div>
        <div class="msg" id="msg">Procesando autenticación...</div>
        <div class="sub" id="sub"></div>
        <div class="manual-link" id="manual-link">
            <a href="#" id="app-link">Pulsa aquí para volver a la app</a>
        </div>
    </div>
    <script>
    (function() {
        var hash = window.location.hash.substring(1);
        var params = new URLSearchParams(hash);
        var idToken = params.get('id_token');

        if (!idToken) {
            document.getElementById('msg').textContent = 'Error: no se recibió token';
            document.getElementById('sub').textContent = 'Vuelve a intentar el inicio de sesión';
            document.getElementById('spinner').style.display = 'none';
            return;
        }

        // Exchange id_token for our session token
        fetch('auth.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id_token: idToken})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                document.getElementById('msg').textContent = '¡Sesión iniciada!';
                document.getElementById('sub').textContent = 'Volviendo a Suno Play...';
                document.getElementById('spinner').style.display = 'none';

                var authParams = new URLSearchParams({
                    token: data.session_token,
                    name: data.user.name || '',
                    email: data.user.email || '',
                    avatar: data.user.avatar || '',
                    id: data.user.id || ''
                });
                var appUrl = 'sunoplay://auth?' + authParams.toString();

                // Try to open app
                window.location.href = appUrl;

                // Show manual link after a delay (in case auto-redirect doesn't work)
                setTimeout(function() {
                    var link = document.getElementById('manual-link');
                    var appLink = document.getElementById('app-link');
                    appLink.href = appUrl;
                    link.style.display = 'block';
                    document.getElementById('sub').textContent = 'Si no se abre automáticamente:';
                }, 2000);
            } else {
                document.getElementById('msg').textContent = 'Error de autenticación';
                document.getElementById('sub').textContent = data.error || 'Inténtalo de nuevo';
                document.getElementById('spinner').style.display = 'none';
            }
        })
        .catch(function(e) {
            document.getElementById('msg').textContent = 'Error de conexión';
            document.getElementById('sub').textContent = 'Inténtalo de nuevo';
            document.getElementById('spinner').style.display = 'none';
        });
    })();
    </script>
</body>
</html>
