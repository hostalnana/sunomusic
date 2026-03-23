<?php
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Suno Play - Iniciar sesión</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #050507;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .login-container { text-align: center; max-width: 360px; width: 100%; }
        .logo-icon { font-size: 64px; margin-bottom: 16px; }
        h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        h1 span { font-size: 14px; font-weight: 400; color: #888; display: block; margin-top: 4px; }
        .subtitle { color: #aaa; font-size: 14px; margin: 24px 0 32px; }
        .google-btn {
            display: inline-flex; align-items: center; justify-content: center;
            padding: 12px 24px; background: #fff; color: #1f1f1f; border: none;
            border-radius: 24px; font-size: 15px; font-weight: 500; cursor: pointer;
            text-decoration: none; min-width: 280px;
        }
        .google-btn:active { background: #e8e8e8; }
        .google-btn svg { margin-right: 10px; flex-shrink: 0; }
        #status { color: #888; font-size: 13px; min-height: 20px; margin-top: 16px; }
        .back-link { display: inline-block; margin-top: 32px; color: #666; font-size: 13px; text-decoration: none; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo-icon">🎵</div>
        <h1>Suno Play <span>by ChemaDev</span></h1>
        <p class="subtitle">Inicia sesión con Google para acceder</p>
        <a href="#" id="login-btn" class="google-btn" onclick="startGoogleLogin(); return false;">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Iniciar sesión con Google
        </a>
        <p id="status"></p>
        <a href="https://app.lomastrend.com/sunoplay/" class="back-link">Volver a Suno Play</a>
    </div>

    <script>
    function startGoogleLogin() {
        document.getElementById('status').textContent = 'Redirigiendo a Google...';
        var nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
        var url = 'https://accounts.google.com/o/oauth2/v2/auth'
            + '?client_id=417309092514-trlid9cfs4ugeedc6721bt7bgdiplgnc.apps.googleusercontent.com'
            + '&redirect_uri=' + encodeURIComponent('https://app.lomastrend.com/sunoplay/api/auth_redirect.php')
            + '&response_type=id_token'
            + '&scope=' + encodeURIComponent('openid email profile')
            + '&nonce=' + nonce
            + '&prompt=select_account';
        window.location.href = url;
    }
    </script>
</body>
</html>
