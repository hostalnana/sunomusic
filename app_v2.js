// === ChemPlay v3.0 ===

// === Google OAuth Config ===
const GOOGLE_CLIENT_ID = '417309092514-trlid9cfs4ugeedc6721bt7bgdiplgnc.apps.googleusercontent.com';

// === Auth State ===
let currentUser = null;
let authToken = null;

// === Demo Tracks ===
const demoTracks = [
    { id: "neon-nights", title: "Neon Nights", artist: "Suno AI Pro", url: "audio/song-1.mp3", thumb: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500" },
    { id: "velvet-echo", title: "Velvet Echo", artist: "Suno AI Studio", url: "audio/song-2.mp3", thumb: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500" },
    { id: "afrorave-pulse", title: "Afrorave Pulse", artist: "Suno AI Expert", url: "audio/song-3.mp3", thumb: "https://images.unsplash.com/photo-1459749411177-042180ceea72?w=500" },
    { id: "golden-hour", title: "Golden Hour", artist: "Suno AI Chill", url: "audio/song-4.mp3", thumb: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500" },
    { id: "midnight-drive", title: "Midnight Drive", artist: "Suno AI Beats", url: "audio/song-5.mp3", thumb: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500" },
    { id: "aurora-borealis", title: "Aurora Borealis", artist: "Suno AI Ambient", url: "audio/song-6.mp3", thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=500" },
    { id: "neon-samurai", title: "Neon Samurai", artist: "Suno AI Generation", url: "audio/song-7.mp3", thumb: "https://images.unsplash.com/photo-1563089145-599997674d42?w=500" },
    { id: "cyber-silk", title: "Cyber Silk", artist: "Suno AI Pro", url: "audio/song-8.mp3", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500" },
    { id: "cosmic-rain", title: "Cosmic Rain", artist: "Suno AI Lab", url: "audio/song-9.mp3", thumb: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=500" },
    { id: "stellar-waves", title: "Stellar Waves", artist: "Suno AI Lab", url: "audio/song-10.mp3", thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500" },
    { id: "electric-dream", title: "Electric Dream", artist: "Suno AI Studio", url: "audio/song-11.mp3", thumb: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=500" },
    { id: "tokyo-drift", title: "Tokyo Drift", artist: "Suno AI Beats", url: "audio/song-12.mp3", thumb: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500" },
    { id: "shadow-funk", title: "Shadow Funk", artist: "Suno AI Expert", url: "audio/song-13.mp3", thumb: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=500" },
    { id: "crystal-caves", title: "Crystal Caves", artist: "Suno AI Ambient", url: "audio/song-14.mp3", thumb: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500" },
    { id: "dreamy-phonk", title: "Dreamy Phonk", artist: "Suno AI User", url: "audio/song-15.mp3", thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500" },
    { id: "vapor-sunset", title: "Vapor Sunset", artist: "Suno AI Chill", url: "audio/song-16.mp3", thumb: "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=500" },
    { id: "chill-lofi", title: "Chill Lo-Fi Beats", artist: "Pixabay Music", url: "audio/chill-lofi-1.mp3", thumb: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=500" },
    { id: "electronic-future", title: "Electronic Future", artist: "Pixabay Music", url: "audio/electronic-future-1.mp3", thumb: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500" },
    { id: "epic-cinematic", title: "Epic Cinematic", artist: "Pixabay Music", url: "audio/epic-cinematic.mp3", thumb: "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=500" },
    { id: "relaxing-guitar", title: "Relaxing Guitar", artist: "Pixabay Music", url: "audio/relaxing-guitar.mp3", thumb: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500" },
    { id: "ambient-piano", title: "Ambient Piano", artist: "Pixabay Music", url: "audio/ambient-piano.mp3", thumb: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500" }
];

const wheelGenres = [
    "electronic", "rock", "pop", "jazz", "ambient", "hiphop", "classical",
    "chillout", "lounge", "dance", "indie", "metal", "reggae", "soul",
    "funk", "blues", "techno", "house", "trance", "dubstep", "folk",
    "country", "rnb", "punk", "grunge", "disco", "latin", "world",
    "soundtrack", "newage", "experimental", "acoustic", "piano"
];

const HEARTS_CONFIG = { maxHearts: 5, minHearts: -5, defaultHearts: 1 };

// === Auth Helper ===
function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    return headers;
}

// === Server API ===
async function fetchSunoTracks(tag) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`api/suno.php?tag=${encodeURIComponent(tag)}&limit=5`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const tracks = await res.json();
        return (Array.isArray(tracks) && tracks.length > 0) ? tracks : null;
    } catch (e) {
        clearTimeout(timeout);
        return null;
    }
}

async function fetchJamendoTracks(tag) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`api/jamendo.php?tag=${encodeURIComponent(tag)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const tracks = await res.json();
        return (Array.isArray(tracks) && tracks.length > 0) ? tracks : null;
    } catch (e) {
        clearTimeout(timeout);
        return null;
    }
}

async function saveSongToDB(songMeta) {
    try {
        const res = await fetch('api/save_to_server.php', {
            method: 'POST',
            body: JSON.stringify({
                genre: songMeta.genre || currentGenre || "Otros",
                id: songMeta.id,
                title: songMeta.title,
                artist: songMeta.artist,
                url: songMeta.url,
                thumb: songMeta.thumb
            })
        });
        return await res.json();
    } catch (e) {
        return { success: false };
    }
}

async function getAllSongs() {
    try {
        const res = await fetch('api/get_library.php');
        return await res.json();
    } catch (e) {
        return [];
    }
}

async function deleteSongFromDB(id) {
    try {
        await fetch('api/delete_from_server.php', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
    } catch (e) { }
}

async function getLibraryStats() {
    const songs = await getAllSongs();
    const totalSize = songs.reduce((acc, s) => acc + (s.size || 0), 0);
    return { count: songs.length, totalSize };
}

async function saveHeartsToServer(songId, hearts) {
    try {
        const res = await fetch("api/save_hearts.php", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ songId, hearts })
        });
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function loadHeartsFromServer() {
    try {
        const res = await fetch("api/get_hearts.php", { headers: authHeaders() });
        return await res.json() || {};
    } catch (e) {
        return {};
    }
}

// === DOM ===
const mainAudio = document.getElementById('main-audio');
if (mainAudio) mainAudio.crossOrigin = "anonymous";
const playerThumb = document.getElementById('player-thumb');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const artworkWrapper = document.getElementById('artwork-wrapper');
const loadingIndicator = document.getElementById('loading-indicator');
const seekBar = document.getElementById('seek-bar');
const seekFill = document.getElementById('seek-fill');
const timeCurrentEl = document.getElementById('time-current');
const timeTotalEl = document.getElementById('time-total');
const volumeSlider = document.getElementById('volume-slider');
const volumeFill = document.getElementById('volume-fill');
const volumeIcon = document.getElementById('volume-icon');
const playerGenreEl = document.getElementById('player-genre');

// === State ===
let isPlaying = false;
let isLoading = false;
let currentSong = null;
let currentGenre = "Varios";
let selectedGenreFilter = null;
let unifiedHearts = {};
let audioCtx, analyser, dataArray, source;
let isSeeking = false;
let playHistory = [];
let historyIndex = -1;

// === Detect native app WebView ===
const isNativeApp = navigator.userAgent.includes('SunoPlayApp');

// === Native Bridge State (for native app audio delegation) ===
let nativeState = { playing: false, position: 0, duration: 0, state: 'none' };

window.nativeBridge = {
    onEvent(event, data) {
        switch (event) {
            case 'playbackState':
                nativeState.state = data.state || 'none';
                isPlaying = (data.state === 'playing' || data.state === 'buffering');
                if (data.position !== undefined) nativeState.position = data.position / 1000;
                if (data.duration !== undefined && data.duration > 0) nativeState.duration = data.duration / 1000;

                // Sync metadata from native side
                if (data.title) {
                    const needsSync = !currentSong || (data.mediaId && data.mediaId !== currentSong.id);
                    if (needsSync) {
                        currentSong = {
                            id: data.mediaId || '', title: data.title,
                            artist: data.artist || '', genre: '',
                            url: '', thumb: data.artUri || 'icon.png'
                        };
                        playerTitle.textContent = data.title;
                        playerArtist.textContent = data.artist || '';
                        if (data.artUri) playerThumb.src = data.artUri;
                        updateHeartsDisplay();
                    }
                }

                if (data.state === 'buffering' && loadingIndicator) loadingIndicator.style.display = 'block';
                else if (loadingIndicator) loadingIndicator.style.display = 'none';
                updatePlayerUI();
                if (!isSeeking) updateNativeSeekBar();
                break;
            case 'songComplete':
                handleVote('like', true);
                break;
            case 'heartsUpdate':
                if (data && data.songId) {
                    unifiedHearts[data.songId] = data.hearts;
                    updateHeartsDisplay();
                    const emoji = data.delta > 0 ? '❤️' : '💔';
                    showToast(`${emoji} ${data.delta > 0 ? '+' : ''}${data.delta} (${data.hearts})`);
                }
                break;
            case 'error':
                isLoading = false;
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                showToast('Error: ' + (data && data.message ? data.message : 'reproduccion'));
                setTimeout(() => playNext(false), 1500);
                break;
        }
    }
};

function updateNativeSeekBar() {
    if (isSeeking || nativeState.duration <= 0) return;
    const pct = (nativeState.position / nativeState.duration) * 100;
    if (seekFill) seekFill.style.width = Math.min(100, pct) + '%';
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(nativeState.position);
    if (timeTotalEl) timeTotalEl.textContent = formatTime(nativeState.duration);
}

// === Google Sign-In ===
function initGoogleSignIn() {
    // Auto-login si tiene token guardado
    const savedToken = localStorage.getItem('sunoplay-auth-token');
    if (savedToken) {
        authToken = savedToken;
        const savedUser = JSON.parse(localStorage.getItem('sunoplay-user') || 'null');
        if (savedUser) {
            currentUser = savedUser;
            showUserLoggedIn();
            hideWelcomeModal();
            // Refrescar perfil si falta email (usuarios antiguos)
            if (!savedUser.email) {
                fetch('api/me.php', { headers: { 'Authorization': 'Bearer ' + savedToken } })
                    .then(r => r.json()).then(d => {
                        if (d.success && d.user) {
                            currentUser = { ...currentUser, ...d.user };
                            localStorage.setItem('sunoplay-user', JSON.stringify(currentUser));
                            showUserLoggedIn();
                        }
                    }).catch(() => {});
            }
            return;
        }
    }

    const btnContainer = document.getElementById('google-signin-btn');

    // In native app WebView, use native bridge for login (GSI blocked in WebView)
    if (isNativeApp) {
        if (btnContainer) {
            btnContainer.innerHTML = '<button onclick="nativeGoogleLogin()" class="native-login-btn">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" style="margin-right:8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>' +
                'Iniciar sesión con Google</button>';
        }
        return;
    }

    // Normal web: use Google GSI library
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleSignIn, 500);
        return;
    }
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: true
    });

    if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 280
        });
    }
}

// Open login in system browser via native bridge
function nativeGoogleLogin() {
    if (window.AndroidBridge) {
        window.AndroidBridge.openGoogleLogin();
    } else {
        // Fallback: open directly
        window.open('https://app.lomastrend.com/sunoplay/login_native.html', '_blank');
    }
}

// Handle auth callback from native app
window.handleNativeAuth = function(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('sunoplay-auth-token', token);
    localStorage.setItem('sunoplay-user', JSON.stringify(user));
    showUserLoggedIn();
    hideWelcomeModal();
    loadHeartsFromServer().then(h => { unifiedHearts = h; updateHeartsDisplay(); });
    showToast('Hola ' + (user.name || '').split(' ')[0] + '!');
    // Pass token to native bridge for API calls
    if (isNativeApp && window.AndroidBridge) {
        try { AndroidBridge.setAuthToken(token); } catch (e) {}
    }
};

async function handleGoogleCredential(response) {
    const idToken = response.credential;
    try {
        const res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            authToken = data.session_token;
            localStorage.setItem('sunoplay-auth-token', data.session_token);
            localStorage.setItem('sunoplay-user', JSON.stringify(data.user));
            showUserLoggedIn();
            hideWelcomeModal();
            // Recargar hearts del usuario
            unifiedHearts = await loadHeartsFromServer();
            updateHeartsDisplay();
            showToast(`Hola ${data.user.name.split(' ')[0]}!`);
        } else {
            showToast('Error de autenticación');
        }
    } catch (e) {
        showToast('Error de conexión');
    }
}

function showUserLoggedIn() {
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const authBtn = document.getElementById('auth-btn');

    if (currentUser && userInfo) {
        userInfo.style.display = 'flex';
        if (userAvatar) userAvatar.src = currentUser.avatar || '';
        if (authBtn) authBtn.style.display = 'none';
        // Admin: solo chemazener@gmail.com
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            const isAdmin = (currentUser.email || '').toLowerCase() === 'chemazener@gmail.com';
            adminBtn.style.display = isAdmin ? 'flex' : 'none';
        }
    } else if (authBtn) {
        authBtn.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) adminBtn.style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('sunoplay-auth-token');
    localStorage.removeItem('sunoplay-user');
    showUserLoggedIn();
    showToast('Sesión cerrada');
    // Mostrar modal de login obligatorio
    showWelcomeModal();
}

// === App Version Check (for native app) ===
async function checkAppVersion() {
    if (!isNativeApp) return false;
    // Extract version from UA: "SunoPlayApp/1.0" -> "1.0"
    const match = navigator.userAgent.match(/SunoPlayApp\/([\d.]+)/);
    const localVersion = match ? match[1] : '0';
    try {
        const res = await fetch('api/app_version.php?_=' + Date.now());
        const data = await res.json();
        if (data.version_name && data.version_name !== localVersion && data.apk_url) {
            return data;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function showUpdateModal(versionData) {
    // Create update modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'update-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
        <div style="background:#111118;border-radius:20px;padding:32px 24px;max-width:340px;width:100%;text-align:center;border:1px solid rgba(139,92,246,0.3);">
            <div style="font-size:48px;margin-bottom:12px;">🚀</div>
            <h2 style="color:#fff;font-size:22px;margin-bottom:8px;">Nueva versión ${versionData.version_name}</h2>
            <p style="color:#aaa;font-size:14px;margin-bottom:24px;line-height:1.5;">${versionData.changelog || 'Mejoras y correcciones.'}</p>
            <a href="${versionData.apk_url}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:30px;font-weight:600;font-size:15px;margin-bottom:12px;">Descargar actualización</a>
            ${!versionData.force_update ? '<br><button id="skip-update-btn" style="background:none;border:none;color:#666;font-size:13px;margin-top:12px;cursor:pointer;padding:8px;">Más tarde</button>' : ''}
        </div>`;
    document.body.appendChild(overlay);

    if (!versionData.force_update) {
        document.getElementById('skip-update-btn')?.addEventListener('click', () => {
            overlay.remove();
            // After dismissing update, show login if needed
            const savedToken = localStorage.getItem('sunoplay-auth-token');
            if (!savedToken) showWelcomeModal();
        });
    }
}

// === Welcome Modal ===
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = '';
        modal.classList.remove('closing');
        modal.classList.add('active');
    }
}

function hideWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('closing');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
}

// === What's New (Novedades) ===
const APP_VERSION = '3.4.0';
const WHATS_NEW_FEATURES = [
    { icon: '💔', title: 'Dislike inteligente', desc: 'Si una canción llega a -1 corazones se elimina de la cola y salta automáticamente.' },
    { icon: '🎲', title: 'Botón Al Azar', desc: 'Salta a una canción aleatoria de la cola actual.' },
    { icon: '✨', title: 'Botón Sorpresa', desc: 'Mezcla toda la biblioteca y reproduce al azar.' },
    { icon: '❤️', title: 'Corazones visibles', desc: 'Número de corazones visible en Android Auto, notificación y pantalla bloqueada.' },
    { icon: '🔍', title: 'Búsqueda mejorada', desc: 'Busca desde 2 caracteres. YouTube y Torrents siempre visibles.' },
    { icon: '🚗', title: 'Android Auto completo', desc: 'Like, dislike, al azar, sorpresa, búsqueda por voz y caché de siguiente canción.' },
    { icon: '⚡', title: 'Reproducción sin cortes', desc: 'La siguiente canción se precarga en segundo plano para transiciones instantáneas.' }
];

function showWhatsNew() {
    const lastSeen = localStorage.getItem('sunoplay-whats-new-version');
    if (lastSeen === APP_VERSION) return;

    const overlay = document.createElement('div');
    overlay.id = 'whats-new-modal';
    overlay.className = 'error-modal-overlay';
    overlay.style.display = 'flex';

    const featuresHtml = WHATS_NEW_FEATURES.map(f => `
        <div class="whats-new-item">
            <span class="whats-new-icon">${f.icon}</span>
            <div class="whats-new-text">
                <strong>${f.title}</strong>
                <span>${f.desc}</span>
            </div>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="whats-new-container">
            <div class="whats-new-header">
                <div class="whats-new-version">v${APP_VERSION}</div>
                <h2>Novedades</h2>
            </div>
            <div class="whats-new-list">${featuresHtml}</div>
            <button class="whats-new-close" onclick="dismissWhatsNew()">Entendido</button>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function dismissWhatsNew() {
    localStorage.setItem('sunoplay-whats-new-version', APP_VERSION);
    const modal = document.getElementById('whats-new-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// === Utility ===
function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;

    // Posicionar sobre el artwork si existe
    const artwork = document.getElementById('artwork-wrapper');
    if (artwork) {
        artwork.appendChild(toast);
        toast.style.position = 'absolute';
        toast.style.bottom = '20px';
    } else {
        document.body.appendChild(toast);
    }

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// === Animation Helpers ===
function animateClick(el) {
    if (!el) return;
    el.classList.add('btn-clicked');
    setTimeout(() => el.classList.remove('btn-clicked'), 400);
}

function spawnEmojiBurst(x, y, emoji) {
    for (let i = 0; i < 6; i++) {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.style.position = 'fixed';
        span.style.left = x + 'px';
        span.style.top = y + 'px';
        span.style.pointerEvents = 'none';
        span.style.zIndex = '3000';
        span.style.fontSize = '24px';
        span.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        document.body.appendChild(span);

        const angle = (Math.random() * Math.PI * 2);
        const dist = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 100;

        requestAnimationFrame(() => {
            span.style.transform = `translate(${tx}px, ${ty}px) scale(0) rotate(${Math.random() * 360}deg)`;
            span.style.opacity = '0';
        });
        setTimeout(() => span.remove(), 800);
    }
}

// === Search Helpers ===
function openSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    if (!overlay) return;
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('active');
        input.focus();
    }, 10);
    animateClick(playerTitle);
    // Show active downloads at the top
    showActiveDownloadsInSearch();
}

let searchDownloadPollInterval = null;

async function showActiveDownloadsInSearch() {
    // Initial render
    await updateActiveDownloadsUI();
    // Start live polling every 3s
    if (searchDownloadPollInterval) clearInterval(searchDownloadPollInterval);
    searchDownloadPollInterval = setInterval(updateActiveDownloadsUI, 3000);
}

async function updateActiveDownloadsUI() {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    try {
        const res = await fetch('api/torrent_download.php?list');
        const data = await res.json();

        // Remove previous downloads section
        const prev = resultsContainer.querySelector('.active-downloads-section');
        if (prev) prev.remove();

        if (!data.success || !data.jobs || data.jobs.length === 0) {
            // No active downloads — stop polling
            if (searchDownloadPollInterval) { clearInterval(searchDownloadPollInterval); searchDownloadPollInterval = null; }
            return;
        }

        let html = '<div class="active-downloads-section">';
        html += '<div class="torrent-section-header" style="margin-top:0;border-top:none;">Descargas activas</div>';
        data.jobs.forEach(j => {
            const elapsed = Math.round((Date.now()/1000) - j.started);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const statusLabel = j.status === 'metadata' ? 'Resolviendo...' :
                                j.status === 'processing' ? 'Procesando...' :
                                j.progress + '%';
            const dlInfo = j.downloaded && j.total ? ` ${j.downloaded}/${j.total}` : '';
            const speed = j.speed ? ` ${j.speed}` : '';
            html += `
                <div class="search-result-item torrent-result active-download-item" id="dl-${j.jobId}">
                    <div class="torrent-icon" style="font-size:18px;">&#x23F3;</div>
                    <div class="search-result-info" style="flex:1;min-width:0;">
                        <div class="search-result-title">${j.title}</div>
                        <div class="search-result-artist">
                            ${statusLabel}${dlInfo}${speed}
                            &middot; ${mins}m ${secs}s
                            <span class="search-badge torrent">${j.status}</span>
                        </div>
                        ${j.status === 'downloading' && j.progress > 0 ? `
                        <div class="dl-progress-bar-wrap">
                            <div class="dl-progress-bar-fill" style="width:${j.progress}%"></div>
                        </div>` : ''}
                    </div>
                    <button class="ranking-delete" onclick="event.stopPropagation();cancelDownloadFromSearch('${j.jobId}')" title="Cancelar">&#x2716;</button>
                </div>`;
        });
        html += '</div>';

        resultsContainer.insertAdjacentHTML('afterbegin', html);
    } catch (e) { /* ignore */ }
}

async function cancelDownloadFromSearch(jobId) {
    if (!confirm('Cancelar esta descarga?')) return;
    // Stop polling
    if (activeTorrentPolls[jobId]) {
        clearInterval(activeTorrentPolls[jobId]);
        delete activeTorrentPolls[jobId];
    }
    hideTorrentProgress();
    try {
        await fetch('api/torrent_download.php?cancel=' + jobId);
    } catch(e) {}
    // Remove from UI
    const el = document.getElementById('dl-' + jobId);
    if (el) el.remove();
    // Remove section if empty
    const section = document.querySelector('.active-downloads-section');
    if (section && !section.querySelector('.active-download-item')) section.remove();
    showToast('Descarga cancelada');
}

function closeSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    if (!overlay) return;
    overlay.classList.remove('active');
    input.value = '';
    document.getElementById('search-results').innerHTML = '';
    // Stop live polling of active downloads
    if (searchDownloadPollInterval) { clearInterval(searchDownloadPollInterval); searchDownloadPollInterval = null; }
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

async function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    resultsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px;">Buscando...</p>';

    const q = query.toLowerCase();

    // Check if query is a YouTube URL
    if (isYouTubeUrl(query.trim())) {
        resultsContainer.innerHTML = `
            <div class="search-result-item yt-download-item" onclick="downloadFromYouTube('${query.trim().replace(/'/g, "\\'")}'); closeSearch();">
                <div class="yt-icon-big">&#x25B6;&#xFE0F;</div>
                <div class="search-result-info">
                    <div class="search-result-title">Descargar de YouTube</div>
                    <div class="search-result-artist">${query.trim().substring(0, 60)} <span class="search-badge yt">YouTube</span></div>
                </div>
            </div>`;
        return;
    }

    // 1. Resultados locales (coincidencia parcial - contains)
    const allSongs = await getAllSongs();
    const localResults = allSongs.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.genre || '').toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 6).map(s => ({ ...s, source: 'local' }));

    // 2. Resultados de API (Suno + Jamendo)
    let apiResults = [];
    try {
        const resp = await fetch(`api/search.php?q=${encodeURIComponent(query)}&limit=8`);
        if (resp.ok) {
            const data = await resp.json();
            apiResults = (data || []).map(s => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                url: s.url,
                thumb: s.thumb || 'icon.png',
                genre: s.genre || '',
                source: s.source || 'api'
            }));
        }
    } catch (e) { /* sin conexión, solo locales */ }

    // 3. Merge: locales primero, luego API sin duplicar ids
    const localIds = new Set(localResults.map(s => s.id));
    const merged = [...localResults, ...apiResults.filter(s => !localIds.has(s.id))];

    const sourceBadge = (source) => {
        if (source === 'local') return '<span class="search-badge local">📚 Local</span>';
        if (source === 'suno') return '<span class="search-badge suno">🔥 Suno</span>';
        return '<span class="search-badge jamendo">🎵 Jamendo</span>';
    };

    let html = '';

    if (merged.length === 0) {
        html = '<p style="text-align:center;color:var(--text-muted);padding:16px;">Sin resultados en biblioteca</p>';
    } else {
        html = merged.map(s => {
            const songData = encodeURIComponent(JSON.stringify({
                id: s.id, title: s.title, artist: s.artist,
                url: s.url, thumb: s.thumb || 'icon.png', genre: s.genre
            }));
            return `
                <div class="search-result-item" onclick="playFromSearch('${songData}')">
                    <img class="search-result-thumb" src="${s.thumb || 'icon.png'}" alt="" onerror="this.src='icon.png'">
                    <div class="search-result-info">
                        <div class="search-result-title">${s.title}</div>
                        <div class="search-result-artist">${s.artist} ${sourceBadge(s.source)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Siempre mostrar botones de YouTube y Torrents
    const safeQuery = query.replace(/'/g, "\\'");
    html += `
        <div class="search-external-buttons">
            <div class="yt-search-btn" onclick="searchYouTube('${safeQuery}')">
                &#x25B6;&#xFE0F; Buscar en YouTube
            </div>
            <div class="torrent-search-btn" onclick="searchTorrents('${safeQuery}')">
                &#x1F9F2; Buscar en Torrents
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

function playFromSearch(songJson) {
    const song = JSON.parse(decodeURIComponent(songJson));
    closeSearch();
    tryPlaySong(song).then(() => updateHeartsDisplay());
}

// === Animation Helpers ===
function animateClick(el) {
    if (!el) return;
    el.classList.add('btn-clicked');
    setTimeout(() => el.classList.remove('btn-clicked'), 400);
}

function spawnEmojiBurst(x, y, emoji) {
    for (let i = 0; i < 6; i++) {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.style.position = 'fixed';
        span.style.left = x + 'px';
        span.style.top = y + 'px';
        span.style.pointerEvents = 'none';
        span.style.zIndex = '3000';
        span.style.fontSize = '24px';
        span.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        document.body.appendChild(span);

        const angle = (Math.random() * Math.PI * 2);
        const dist = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 100;

        requestAnimationFrame(() => {
            span.style.transform = `translate(${tx}px, ${ty}px) scale(0) rotate(${Math.random() * 360}deg)`;
            span.style.opacity = '0';
        });
        setTimeout(() => span.remove(), 800);
    }
}

// === Seek Bar ===
function updateSeekBar() {
    if (isNativeApp) return; // Native uses updateNativeSeekBar via bridge events
    if (isSeeking || !mainAudio.duration) return;
    const pct = (mainAudio.currentTime / mainAudio.duration) * 100;
    if (seekFill) seekFill.style.width = pct + '%';
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(mainAudio.currentTime);
    if (timeTotalEl) timeTotalEl.textContent = formatTime(mainAudio.duration);
    requestAnimationFrame(updateSeekBar);
}

function initSeekBar() {
    if (!seekBar) return;
    const getPos = (e) => {
        const rect = seekBar.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };
    const startSeek = (e) => { isSeeking = true; seekFill.style.width = (getPos(e) * 100) + '%'; };
    const moveSeek = (e) => {
        if (!isSeeking) return;
        const pct = getPos(e);
        seekFill.style.width = (pct * 100) + '%';
        const dur = (isNativeApp) ? nativeState.duration : mainAudio.duration;
        timeCurrentEl.textContent = formatTime(pct * dur);
    };
    const endSeek = (e) => {
        if (!isSeeking) return;
        isSeeking = false;
        const rect = seekBar.getBoundingClientRect();
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        if (isNativeApp && window.AndroidBridge) {
            const ms = Math.round(pct * nativeState.duration * 1000);
            try { AndroidBridge.seekTo(ms); } catch (e2) {}
            nativeState.position = pct * nativeState.duration;
            updateNativeSeekBar();
        } else {
            mainAudio.currentTime = pct * mainAudio.duration;
            requestAnimationFrame(updateSeekBar);
        }
    };
    seekBar.addEventListener('mousedown', startSeek);
    seekBar.addEventListener('touchstart', startSeek, { passive: true });
    document.addEventListener('mousemove', moveSeek);
    document.addEventListener('touchmove', moveSeek, { passive: true });
    document.addEventListener('mouseup', endSeek);
    document.addEventListener('touchend', endSeek);
}

// === Volume ===
function initVolume() {
    const saved = localStorage.getItem('sunoplay-volume');
    mainAudio.volume = saved ? parseFloat(saved) : 0.8;
    updateVolumeUI();
    if (!volumeSlider) return;
    const getPos = (e) => {
        const rect = volumeSlider.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };
    const setVol = (e) => {
        const v = getPos(e);
        mainAudio.volume = v;
        mainAudio.muted = false;
        localStorage.setItem('sunoplay-volume', v);
        if (isNativeApp && window.AndroidBridge) {
            try { AndroidBridge.setVolume(v); } catch (e2) {}
        }
        updateVolumeUI();
    };
    let dragging = false;
    volumeSlider.addEventListener('mousedown', (e) => { dragging = true; setVol(e); });
    volumeSlider.addEventListener('touchstart', (e) => { dragging = true; setVol(e); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (dragging) setVol(e); });
    document.addEventListener('touchmove', (e) => { if (dragging) setVol(e); }, { passive: true });
    document.addEventListener('mouseup', () => { dragging = false; });
    document.addEventListener('touchend', () => { dragging = false; });
}

function updateVolumeUI() {
    const v = mainAudio.muted ? 0 : mainAudio.volume;
    if (volumeFill) volumeFill.style.width = (v * 100) + '%';
    if (volumeIcon) {
        let icon = 'volume-2';
        if (v === 0 || mainAudio.muted) icon = 'volume-x';
        else if (v < 0.4) icon = 'volume';
        else if (v < 0.7) icon = 'volume-1';
        volumeIcon.setAttribute('data-lucide', icon);
        lucide.createIcons();
    }
}

// === Hearts Display ===
function updateHeartsDisplay() {
    const display = document.getElementById("unified-hearts-display");
    if (!display || !currentSong) return;
    const hearts = unifiedHearts[currentSong.id] ?? HEARTS_CONFIG.defaultHearts;
    let html = "";
    if (hearts >= 0) {
        for (let i = 0; i < HEARTS_CONFIG.maxHearts; i++) {
            html += i < hearts ? "❤️" : '<span style="opacity:0.3">🖤</span>';
        }
    } else {
        for (let i = 0; i < Math.abs(hearts); i++) {
            html += "💔";
        }
    }
    html += `<span class="hearts-count">(${hearts})</span>`;
    display.innerHTML = html;
}

async function handleVote(type, isAuto = false) {
    if (!currentSong) { if (!isAuto) showToast("No hay canción"); return; }

    // Animar botón si es manual
    if (!isAuto) {
        const btnId = type === 'like' ? 'vote-like' : 'vote-dislike';
        const btn = document.getElementById(btnId);
        animateClick(btn);
        if (btn) {
            const rect = btn.getBoundingClientRect();
            spawnEmojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, type === 'like' ? '❤️' : '💔');
        }
    }

    const songId = currentSong.id;
    let hearts = unifiedHearts[songId] ?? HEARTS_CONFIG.defaultHearts;

    if (type === "like") {
        hearts = Math.min(HEARTS_CONFIG.maxHearts, hearts + 1);
        showToast(`👍 +1 ❤️ (${hearts})${isAuto ? ' [Escuchada]' : ''}`);
    } else {
        hearts = Math.max(HEARTS_CONFIG.minHearts, hearts - 1);
        showToast(`👎 -1 💔 (${hearts})${isAuto ? ' [Saltada]' : ''}`);
    }

    unifiedHearts[songId] = hearts;
    const result = await saveHeartsToServer(songId, hearts);

    // Eliminar canción cuando corazones negativos
    if (hearts < 0) {
        const songTitle = currentSong?.title || 'Canción';
        showToast(`🗑️ Eliminando "${songTitle}"...`);
        await deleteSongFromDB(songId);
        delete unifiedHearts[songId];
        showToast(`🔥 "${songTitle}" eliminada`);
        currentSong = null;
        setTimeout(() => playNext(false), 2000);
        return;
    }

    updateHeartsDisplay();

    // Si es automático (ended o skip), pasar a la siguiente sin votar otra vez
    if (isAuto) {
        playNext(false);
    }
}

// === Genre Filter ===
function updateGenreDisplay() {
    const el = document.getElementById("genre-btn-text");
    if (el) el.textContent = selectedGenreFilter || "Todo";
}

function selectGenre(genre) {
    selectedGenreFilter = genre;
    updateGenreDisplay();
    showToast(genre ? `🎵 Filtrado: ${genre}` : "🎵 Todos los géneros");
}

async function openGenreMenu() {
    const songs = await getAllSongs();
    if (!songs || songs.length === 0) { showToast("No hay canciones"); return; }

    const genreStats = {};
    // Calculamos tanto el conteo de canciones como el ranking de popularidad (corazones)
    songs.forEach(s => {
        const g = s.genre || "Sin género";
        if (!genreStats[g]) genreStats[g] = { count: 0, hearts: 0 };
        genreStats[g].count++;
        // Usamos los corazones unificados (votos del usuario + base)
        genreStats[g].hearts += (unifiedHearts[s.id] ?? HEARTS_CONFIG.defaultHearts);
    });

    let html = `
        <div id="genre-modal" class="modal-overlay" onclick="if(event.target===this)closeGenreMenu()">
            <div class="modal-content genre-modal-content">
                <h3 class="modal-title">🎵 Géneros Populares</h3>
                <div class="genre-list">
                    <button class="genre-item ${!selectedGenreFilter ? 'active' : ''}" onclick="selectGenre(null);closeGenreMenu();">
                        <span>🎵 Todos los géneros</span>
                        ${!selectedGenreFilter ? '✓' : ''}
                    </button>`;

    // Ordenar por popularidad (suma de corazones)
    Object.entries(genreStats)
        .sort((a, b) => b[1].hearts - a[1].hearts)
        .forEach(([genre, stats]) => {
            const active = selectedGenreFilter === genre;
            html += `
                    <button class="genre-item ${active ? 'active' : ''}" onclick="selectGenre('${genre.replace(/'/g, "\\'")}');closeGenreMenu();">
                        <div class="genre-info">
                            <span class="genre-name">🎵 ${genre}</span>
                            <span class="genre-popularity">${stats.hearts > 0 ? '🔥 ' + stats.hearts : ''}</span>
                        </div>
                        <div class="genre-meta">
                            <span class="genre-count">${stats.count}</span>
                            ${active ? '✓' : ''}
                        </div>
                    </button>`;
        });

    html += `
                </div>
                <button class="modal-close-btn" onclick="closeGenreMenu()">Cerrar</button>
            </div>
        </div>`;

    const modal = document.createElement("div");
    modal.id = "genre-modal-wrapper";
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

function closeGenreMenu() {
    const modal = document.getElementById("genre-modal");
    if (modal) modal.remove();
}

// === Storage Stats ===
async function updateStorageStats() {
    const stats = await getLibraryStats();
    const countEl = document.getElementById('lib-count');
    const sizeEl = document.getElementById('lib-size');
    if (countEl) countEl.textContent = stats.count;
    if (sizeEl) sizeEl.textContent = formatSize(stats.totalSize);
}

// === Play Logic ===
function addToHistory(song) {
    if (historyIndex < playHistory.length - 1) {
        playHistory = playHistory.slice(0, historyIndex + 1);
    }
    playHistory.push(song);
    historyIndex = playHistory.length - 1;
}

async function playNext(doVote = false) {
    if (isLoading) return;

    let libSongs = await getAllSongs();
    if (libSongs && libSongs.length > 0) {
        if (selectedGenreFilter) {
            const filtered = libSongs.filter(s => (s.genre || "Sin género") === selectedGenreFilter);
            if (filtered.length > 0) {
                libSongs = filtered;
            } else {
                showToast(`No hay canciones de "${selectedGenreFilter}"`);
                selectedGenreFilter = null;
                updateGenreDisplay();
            }
        }

        const weighted = libSongs.map(s => ({ ...s, weight: Math.max(1, (unifiedHearts[s.id] ?? 0) + 1) }));
        const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = weighted[0];
        for (const song of weighted) {
            random -= song.weight;
            if (random <= 0) { selected = song; break; }
        }

        const songData = {
            id: selected.id, title: selected.title, artist: selected.artist,
            url: selected.url, thumb: selected.thumb || "icon.png",
            genre: selected.genre || "Biblioteca"
        };

        if (selectedGenreFilter) {
            showToast(`🎵 ${selectedGenreFilter}: ${songData.title.substring(0, 25)}...`);
        }

        const success = await tryPlaySong(songData);
        if (success) { updateHeartsDisplay(); return; }
    }

    const genre = wheelGenres[Math.floor(Math.random() * wheelGenres.length)];
    currentGenre = genre;

    const jamendoTracks = await fetchJamendoTracks(genre);
    if (jamendoTracks && jamendoTracks.length > 0) {
        const pick = jamendoTracks[Math.floor(Math.random() * jamendoTracks.length)];
        const song = { id: pick.id, title: pick.title, artist: pick.artist, url: pick.audio, thumb: pick.thumb, genre: genre, isJamendo: true };
        showToast(`🎲 ${genre.charAt(0).toUpperCase() + genre.slice(1)} — via Jamendo`);
        const success = await tryPlaySong(song);
        if (!success) setTimeout(playNext, 500);
    } else {
        const demo = demoTracks[Math.floor(Math.random() * demoTracks.length)];
        const song = { id: demo.id, title: demo.title, artist: demo.artist, url: demo.url, genre: "Demo", thumb: demo.thumb };
        showToast(`🎲 ${genre} — modo local`);
        const success = await tryPlaySong(song);
        if (!success) setTimeout(playNext, 500);
    }
}

async function playPrev() {
    if (historyIndex > 0) {
        historyIndex--;
        const song = playHistory[historyIndex];
        await tryPlaySong(song);
    } else if (isNativeApp && window.AndroidBridge) {
        if (nativeState.position > 3) {
            try { AndroidBridge.seekTo(0); } catch (e) {}
            nativeState.position = 0;
            updateNativeSeekBar();
        }
    } else if (mainAudio.currentTime > 3) {
        mainAudio.currentTime = 0;
    }
}

async function tryPlaySong(song) {
    if (isLoading) return false;
    isLoading = true;
    currentSong = song;

    // === Native app: delegate playback to MusicService ===
    if (isNativeApp && window.AndroidBridge) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        playerTitle.textContent = song.title;
        playerArtist.textContent = song.artist;
        if (playerGenreEl) playerGenreEl.textContent = song.genre || '';
        if (song.thumb) playerThumb.src = song.thumb;
        playerThumb.style.opacity = '1';
        try { AndroidBridge.playSong(JSON.stringify(song)); } catch (e) { /* bridge error */ }
        isPlaying = true;
        isLoading = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        addToHistory(song);
        updatePlayerUI();
        saveCurrentToLibrary(song);
        updateHeartsDisplay();
        return true;
    }

    // === Web/PWA: use HTML5 Audio ===
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    playerTitle.textContent = "Sintonizando...";
    playerArtist.textContent = "Conectando...";
    playerThumb.style.opacity = '0.5';
    playerThumb.src = song.thumb;

    const tryUrl = (url, timeout = 5000) => {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                mainAudio.removeEventListener('canplay', onCanPlay);
                mainAudio.removeEventListener('error', onError);
                resolve(false);
            }, timeout);
            const onCanPlay = () => {
                clearTimeout(timer);
                mainAudio.removeEventListener('error', onError);
                mainAudio.play().then(() => resolve(true)).catch(() => resolve(false));
            };
            const onError = () => {
                clearTimeout(timer);
                mainAudio.removeEventListener('canplay', onCanPlay);
                resolve(false);
            };
            mainAudio.addEventListener('canplay', onCanPlay, { once: true });
            mainAudio.addEventListener('error', onError, { once: true });

            let finalUrl = url;
            if (url.startsWith('http') && !url.startsWith(location.origin)) {
                finalUrl = `api/download.php?url=${encodeURIComponent(url)}`;
            }
            mainAudio.src = finalUrl;
            mainAudio.load();
        });
    };

    let success = false;
    let playedSong = song;
    try {
        success = await tryUrl(song.url);

        if (!success) {
            // Reset audio state before retrying
            mainAudio.removeAttribute('src');
            mainAudio.load();
            const libSongs = await getAllSongs();
            if (libSongs.length > 0) {
                const random = libSongs[Math.floor(Math.random() * libSongs.length)];
                success = await tryUrl(random.url, 3000);
                if (success) playedSong = random;
            }
        }
    } catch (e) {
        success = false;
    }

    isLoading = false;
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    playerThumb.style.opacity = '1';
    updatePlayerUI();

    if (success) {
        playerTitle.textContent = playedSong.title;
        playerArtist.textContent = playedSong.artist;
        const genreEl = document.getElementById('player-genre');
        if (genreEl) {
            genreEl.textContent = playedSong.genre || '';
        }
        if (playedSong.thumb) playerThumb.src = playedSong.thumb;
        isPlaying = true;
        addToHistory(playedSong);
        requestAnimationFrame(updateSeekBar);
        saveCurrentToLibrary(playedSong);
        updateHeartsDisplay();
        return true;
    } else {
        playerTitle.textContent = "Error de conexión";
        playerArtist.textContent = "Intentando otra canción...";
        return false;
    }
}

async function saveCurrentToLibrary(songMeta) {
    if (!songMeta || songMeta.url.includes('downloads/')) return;
    await saveSongToDB(songMeta);
    updateStorageStats();
}

// === Player UI ===
function updatePlayerUI() {
    if (playIcon) {
        playIcon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
        playIcon.style.fill = 'black';
    }
    if (artworkWrapper) artworkWrapper.classList.toggle('playing', isPlaying);
    lucide.createIcons();

    if ('mediaSession' in navigator && currentSong) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.title,
            artist: currentSong.artist,
            artwork: currentSong.thumb ? [
                { src: currentSong.thumb, sizes: '96x96', type: 'image/png' },
                { src: currentSong.thumb, sizes: '256x256', type: 'image/png' },
                { src: currentSong.thumb, sizes: '512x512', type: 'image/png' }
            ] : []
        });
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        navigator.mediaSession.setActionHandler('play', () => { if (!isPlaying) handlePlayPause(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (isPlaying) handlePlayPause(); });
        navigator.mediaSession.setActionHandler('stop', handleStop);
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext(true));
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            seekBackward(details.seekOffset || 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            seekForward(details.seekOffset || 10);
        });
        try {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime != null && mainAudio.duration) {
                    mainAudio.currentTime = details.seekTime;
                    updatePositionState();
                }
            });
        } catch (e) { /* seekto not supported */ }
        updatePositionState();
    }
}

function handlePlayPause() {
    if (!currentSong) { playNext(); return; }
    animateClick(playPauseBtn);
    if (isNativeApp && window.AndroidBridge) {
        try {
            if (isPlaying) {
                AndroidBridge.pause();
            } else {
                // Try resume first; if service has no prepared player,
                // re-send the current song to force a fresh play
                AndroidBridge.resume();
                // Also re-send the song in case the service lost state
                setTimeout(() => {
                    if (!isPlaying && currentSong) {
                        AndroidBridge.playSong(JSON.stringify(currentSong));
                    }
                }, 800);
            }
        } catch (e) { /* bridge error */ }
        // Do NOT toggle isPlaying here — let nativeBridge.onEvent update it
        // from the actual service state
        return;
    }
    if (isPlaying) {
        mainAudio.pause();
        isPlaying = false;
        updatePlayerUI();
    } else {
        mainAudio.play().then(() => {
            isPlaying = true;
            updatePlayerUI();
            requestAnimationFrame(updateSeekBar);
        }).catch(() => {
            // play() failed — try reloading the current song
            if (currentSong && currentSong.url) {
                let finalUrl = currentSong.url;
                if (finalUrl.startsWith('http') && !finalUrl.startsWith(location.origin)) {
                    finalUrl = `api/download.php?url=${encodeURIComponent(finalUrl)}`;
                }
                mainAudio.src = finalUrl;
                mainAudio.load();
                mainAudio.play().then(() => {
                    isPlaying = true;
                    updatePlayerUI();
                    requestAnimationFrame(updateSeekBar);
                }).catch(() => {
                    isPlaying = false;
                    updatePlayerUI();
                    showToast("Error al reproducir. Toca siguiente.");
                });
            } else {
                isPlaying = false;
                updatePlayerUI();
            }
        });
    }
}

function handleStop() {
    if (isNativeApp && window.AndroidBridge) {
        try { AndroidBridge.stop(); } catch (e) {}
    } else {
        mainAudio.pause();
        mainAudio.currentTime = 0;
    }
    isPlaying = false;
    nativeState.position = 0;
    if (seekFill) seekFill.style.width = '0%';
    if (timeCurrentEl) timeCurrentEl.textContent = '0:00';
    updatePlayerUI();
}

function seekForward(seconds = 10) {
    if (isNativeApp && window.AndroidBridge) {
        const newPos = Math.min(nativeState.duration, nativeState.position + seconds);
        try { AndroidBridge.seekTo(Math.round(newPos * 1000)); } catch (e) {}
        nativeState.position = newPos;
        updateNativeSeekBar();
        return;
    }
    if (!mainAudio.duration) return;
    mainAudio.currentTime = Math.min(mainAudio.duration, mainAudio.currentTime + seconds);
    updatePositionState();
}

function seekBackward(seconds = 10) {
    if (isNativeApp && window.AndroidBridge) {
        const newPos = Math.max(0, nativeState.position - seconds);
        try { AndroidBridge.seekTo(Math.round(newPos * 1000)); } catch (e) {}
        nativeState.position = newPos;
        updateNativeSeekBar();
        return;
    }
    if (!mainAudio.duration) return;
    mainAudio.currentTime = Math.max(0, mainAudio.currentTime - seconds);
    updatePositionState();
}

function volumeUp() {
    mainAudio.volume = Math.min(1, mainAudio.volume + 0.1);
    mainAudio.muted = false;
    localStorage.setItem('sunoplay-volume', mainAudio.volume);
    updateVolumeUI();
    showToast(`🔊 ${Math.round(mainAudio.volume * 100)}%`);
}

function volumeDown() {
    mainAudio.volume = Math.max(0, mainAudio.volume - 0.1);
    localStorage.setItem('sunoplay-volume', mainAudio.volume);
    updateVolumeUI();
    showToast(`🔉 ${Math.round(mainAudio.volume * 100)}%`);
}

function toggleMute() {
    mainAudio.muted = !mainAudio.muted;
    updateVolumeUI();
    showToast(mainAudio.muted ? '🔇 Silenciado' : `🔊 ${Math.round(mainAudio.volume * 100)}%`);
}

// === Save Button ===
async function handleSaveBtn() {
    if (!currentSong) return;
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.classList.add('saving');
    try {
        const result = await saveSongToDB({ ...currentSong, genre: currentGenre });
        showToast(result.success ? 'Guardada en el servidor' : 'Error al guardar');
        updateStorageStats();
    } catch (e) {
        showToast('No se pudo guardar');
    }
    if (saveBtn) setTimeout(() => saveBtn.classList.remove('saving'), 1000);
}

// === Ranking Panel ===
function toggleRanking() {
    const panel = document.getElementById("ranking-panel");
    if (panel) { panel.remove(); } else { openRanking(); }
}

function toggleRankingGroup(groupId) {
    const list = document.getElementById(groupId);
    const chevron = document.getElementById('chevron-' + groupId);
    if (!list) return;
    list.classList.toggle('collapsed');
    if (chevron) chevron.textContent = list.classList.contains('collapsed') ? '▶' : '▼';
}

function playFromRanking(songJson) {
    const song = JSON.parse(decodeURIComponent(songJson));
    toggleRanking();
    tryPlaySong(song).then(() => updateHeartsDisplay());
}

async function deleteFromRanking(id, title) {
    if (!confirm(`¿Eliminar "${title}"?`)) return;
    await deleteSongFromDB(id);
    delete unifiedHearts[id];
    showToast(`🗑️ "${title}" eliminada`);
    document.getElementById("ranking-panel")?.remove();
    openRanking();
    updateStorageStats();
}

async function deleteGroup(songIds, groupName) {
    if (!confirm(`¿Eliminar ${songIds.length} canciones de "${groupName}"?`)) return;
    showToast(`🗑️ Eliminando ${songIds.length} canciones...`);
    for (const id of songIds) {
        await deleteSongFromDB(id);
        delete unifiedHearts[id];
    }
    showToast(`🗑️ "${groupName}" eliminado (${songIds.length} canciones)`);
    document.getElementById("ranking-panel")?.remove();
    openRanking();
    updateStorageStats();
}

// === Tag System ===
const SOURCE_TAGS = ['YouTube', 'Suno AI', 'Jamendo', 'Torrent', 'Subido'];
const STYLE_TAGS = ['Remix', 'Live', 'Acoustic', 'Instrumental', 'Cover', 'Feat', 'Mix', 'Unplugged', 'Karaoke'];
let rankingActiveTags = new Set();
let rankingAllSongs = [];

function generateTagsJS(song) {
    const tags = [];
    const id = song.id || '';
    const genre = song.genre || '';
    // Fuente
    if (id.startsWith('yt-') || genre === 'YouTube') tags.push('YouTube');
    else if (id.startsWith('torrent-') || genre === 'Torrent') tags.push('Torrent');
    else if (id.startsWith('upload-')) tags.push('Subido');
    else if ((song.artist || '').toLowerCase().includes('jamendo')) tags.push('Jamendo');
    else tags.push('Suno AI');
    // Genero
    if (genre && !['YouTube','Torrent','Otros',''].includes(genre)) {
        genre.toLowerCase().split(/[\s,;\/]+/).forEach(w => {
            w = w.trim();
            if (w.length >= 3) tags.push(w.charAt(0).toUpperCase() + w.slice(1));
        });
    }
    // Keywords en titulo
    const title = (song.title || '').toLowerCase();
    const kws = {remix:'Remix',live:'Live',acoustic:'Acoustic',instrumental:'Instrumental',
                  cover:'Cover',feat:'Feat',mix:'Mix',unplugged:'Unplugged',karaoke:'Karaoke'};
    for (const [k,v] of Object.entries(kws)) {
        if (title.includes(k)) tags.push(v);
    }
    return [...new Set(tags)];
}

function getTagType(tag) {
    if (SOURCE_TAGS.includes(tag)) return 'source';
    if (STYLE_TAGS.includes(tag)) return 'style';
    if (/^\d{4}s$/.test(tag)) return 'decade';
    return 'genre';
}

function renderSongItem(s) {
    const songData = encodeURIComponent(JSON.stringify({
        id: s.id, title: s.title, artist: s.artist,
        url: s.url, thumb: s.thumb || 'icon.png', genre: s.genre
    }));
    return `
        <div class="ranking-song">
            <img class="ranking-thumb" src="${s.thumb || 'icon.png'}" alt="" onerror="this.src='icon.png'" onclick="playFromRanking('${songData}')">
            <div class="ranking-song-info" onclick="playFromRanking('${songData}')">
                <div class="ranking-song-title">${s.title}</div>
                <div class="ranking-song-artist">${s.artist}</div>
            </div>
            <div class="ranking-song-hearts">${s.hearts >= 0 ? "❤️".repeat(Math.min(s.hearts, 5)) : "💔".repeat(Math.min(Math.abs(s.hearts), 5))} <span>${s.hearts}</span></div>
            <button class="ranking-delete" onclick="event.stopPropagation();deleteFromRanking('${s.id}','${s.title.replace(/'/g, "\\'")}')">🗑️</button>
        </div>`;
}

function toggleTag(tag) {
    if (rankingActiveTags.has(tag)) rankingActiveTags.delete(tag);
    else rankingActiveTags.add(tag);
    rerenderRankingContent();
}

function clearTagFilters() {
    rankingActiveTags.clear();
    rerenderRankingContent();
}

function rerenderRankingContent() {
    const container = document.getElementById('ranking-tag-content');
    if (!container) return;
    container.innerHTML = renderTagCloud(rankingAllSongs) + renderFilteredSongs(rankingAllSongs);
}

function renderTagCloud(songs) {
    // Collect all tags with counts
    const tagCounts = {};
    songs.forEach(s => {
        const tags = s.tags || generateTagsJS(s);
        tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    // Sort: source first, then by count descending
    const sorted = Object.entries(tagCounts).sort((a, b) => {
        const typeA = getTagType(a[0]);
        const typeB = getTagType(b[0]);
        const order = { source: 0, genre: 1, style: 2, decade: 3 };
        if (order[typeA] !== order[typeB]) return order[typeA] - order[typeB];
        return b[1] - a[1];
    });

    let html = '<div class="tag-cloud">';
    sorted.forEach(([tag, count]) => {
        const type = getTagType(tag);
        const active = rankingActiveTags.has(tag) ? ' active' : '';
        html += `<button class="tag-pill ${type}${active}" onclick="toggleTag('${tag.replace(/'/g, "\\'")}')">${tag} <span class="tag-count">${count}</span></button>`;
    });
    html += '</div>';

    // Filter bar
    if (rankingActiveTags.size > 0) {
        const filtered = songs.filter(s => {
            const tags = s.tags || generateTagsJS(s);
            return [...rankingActiveTags].every(t => tags.includes(t));
        });
        const filterNames = [...rankingActiveTags].join(' + ');
        const ids = JSON.stringify(filtered.map(s => s.id));
        html += `<div class="tag-filter-bar">
            <span>Filtro: <strong>${filterNames}</strong> (${filtered.length})</span>
            <div style="display:flex;gap:8px;align-items:center;">
                ${filtered.length > 0 ? `<button class="ranking-group-delete" onclick="event.stopPropagation();deleteGroup(${ids.replace(/"/g,'&quot;')},'${filterNames.replace(/'/g,"\\'")}')">🗑️</button>` : ''}
                <button class="tag-filter-clear" onclick="clearTagFilters()">Limpiar</button>
            </div>
        </div>`;
    }

    return html;
}

function renderFilteredSongs(songs) {
    let filtered = songs;
    if (rankingActiveTags.size > 0) {
        filtered = songs.filter(s => {
            const tags = s.tags || generateTagsJS(s);
            return [...rankingActiveTags].some(t => tags.includes(t));
        });
    }
    // Sort by hearts descending
    filtered.sort((a, b) => b.hearts - a.hearts);

    if (filtered.length === 0) {
        return '<div style="text-align:center;color:#666;padding:40px 20px;">No hay canciones con estos filtros</div>';
    }

    return '<div class="ranking-songs-list">' + filtered.map(s => renderSongItem(s)).join('') + '</div>';
}

async function openRanking() {
    const songs = await getAllSongs();
    if (!songs || songs.length === 0) { showToast("Biblioteca vacía"); return; }

    rankingAllSongs = songs.map(s => ({ ...s, hearts: unifiedHearts[s.id] ?? 0 }));
    rankingActiveTags.clear();

    let html = `
        <div id="ranking-panel" class="ranking-panel">
            <div class="ranking-handle" onclick="toggleRanking()"></div>
            <div class="ranking-header">
                <h2>🏆 ${currentUser ? currentUser.name.split(' ')[0] + ' — ' : ''}Biblioteca</h2>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="ranking-count">${rankingAllSongs.length} temas</span>
                    <button class="ranking-close-btn" onclick="toggleRanking()"><i data-lucide="x"></i></button>
                </div>
            </div>
            <div id="ranking-tag-content">
                ${renderTagCloud(rankingAllSongs)}
                ${renderFilteredSongs(rankingAllSongs)}
            </div>
        </div>`;

    const panel = document.createElement("div");
    panel.innerHTML = html;
    document.body.appendChild(panel);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === Admin Panel ===
let adminData = { users: [], songs: [], filters: { users: new Set(), tags: new Set() } };

async function openAdminPanel() {
    showToast('Cargando panel admin...');
    const headers = { 'Authorization': 'Bearer ' + authToken };

    try {
        const [overviewRes, songsRes] = await Promise.all([
            fetch('api/admin.php?action=overview', { headers }),
            fetch('api/admin.php?action=songs', { headers })
        ]);
        const overview = await overviewRes.json();
        const songsData = await songsRes.json();

        if (!overview.success) { showToast('Error: ' + (overview.error || 'no admin')); return; }

        adminData.users = overview.users || [];
        adminData.songs = songsData.songs || [];
        adminData.filters.users.clear();
        adminData.filters.tags.clear();

        renderAdminPanel(overview.library);
    } catch (e) {
        showToast('Error cargando admin');
    }
}

function renderAdminPanel(libStats) {
    // Remove previous
    document.getElementById('admin-panel-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.id = 'admin-panel-wrap';
    wrap.innerHTML = `
        <div class="admin-panel">
            <div class="ranking-handle" onclick="closeAdminPanel()"></div>
            <div class="admin-header">
                <h2>Admin</h2>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="ranking-count">${libStats.total} temas | ${libStats.totalSizeMB} MB</span>
                    <button class="ranking-close-btn" onclick="closeAdminPanel()">✕</button>
                </div>
            </div>

            <div class="admin-section">
                <h3 class="admin-section-title">Usuarios (${adminData.users.length})</h3>
                <div class="admin-users-grid">
                    ${adminData.users.map(u => `
                        <div class="admin-user-card ${adminData.filters.users.has(u.id) ? 'active' : ''}"
                             onclick="toggleAdminUserFilter(${u.id})">
                            <img src="${u.avatar || 'icon.png'}" class="admin-user-avatar" onerror="this.src='icon.png'">
                            <div class="admin-user-info">
                                <div class="admin-user-name">${u.name}</div>
                                <div class="admin-user-meta">${u.total_songs} temas | ${u.total_hearts} ♥</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="admin-section">
                <h3 class="admin-section-title">Filtros por etiqueta</h3>
                <div class="admin-tags-cloud" id="admin-tags-cloud">
                    ${renderAdminTagCloud()}
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-songs-header">
                    <h3 class="admin-section-title" id="admin-songs-title">Canciones</h3>
                    <button class="admin-cleanup-btn" onclick="adminCleanup()">Limpiar sin ♥</button>
                </div>
                <div class="admin-songs-list" id="admin-songs-list">
                    ${renderAdminSongs()}
                </div>
            </div>
        </div>`;

    document.body.appendChild(wrap);
}

function renderAdminTagCloud() {
    const tagCount = {};
    let noTags = 0;
    adminData.songs.forEach(s => {
        const tags = s.tags || [];
        if (tags.length === 0) noTags++;
        tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
    });
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    // Botón especial "Sin etiquetas"
    const noTagActive = adminData.filters.tags.has('__NO_TAGS__') ? 'active' : '';
    let html = `<button class="admin-tag ${noTagActive}" style="border-color:rgba(239,68,68,0.3);color:#ef4444;" onclick="toggleAdminTagFilter('__NO_TAGS__')">Sin etiquetas <span>(${noTags})</span></button>`;
    html += sorted.map(([tag, count]) => {
        const active = adminData.filters.tags.has(tag) ? 'active' : '';
        return `<button class="admin-tag ${active}" onclick="toggleAdminTagFilter('${tag.replace(/'/g, "\\'")}')">${tag} <span>(${count})</span></button>`;
    }).join('');
    return html;
}

function renderAdminSongs() {
    let songs = adminData.songs;

    // Filtrar por usuarios seleccionados
    if (adminData.filters.users.size > 0) {
        songs = songs.filter(s =>
            s.userHearts.some(h => adminData.filters.users.has(h.userId) && h.hearts > 0)
        );
    }

    // Filtrar por tags seleccionados (OR: alguno de los tags)
    if (adminData.filters.tags.size > 0) {
        songs = songs.filter(s => {
            const songTags = s.tags || [];
            return [...adminData.filters.tags].some(t => {
                if (t === '__NO_TAGS__') return songTags.length === 0;
                return songTags.includes(t);
            });
        });
    }

    // Sort by globalHearts descending
    songs.sort((a, b) => b.globalHearts - a.globalHearts);

    // Update title
    const titleEl = document.getElementById('admin-songs-title');
    if (titleEl) titleEl.textContent = `Canciones (${songs.length})`;

    if (songs.length === 0) {
        return '<div style="text-align:center;color:#666;padding:20px;">Sin resultados</div>';
    }

    return songs.map(s => {
        const heartsDetail = s.userHearts.map(h =>
            `<span class="admin-heart-chip ${h.hearts <= 0 ? 'negative' : ''}">${h.userName.split(' ')[0]}: ${h.hearts}</span>`
        ).join('');
        const sizeMB = s.size ? (s.size / 1048576).toFixed(1) + ' MB' : '';
        const age = s.savedAt ? Math.round((Date.now() - s.savedAt) / 86400000) + 'd' : '';
        const tags = (s.tags || []).slice(0, 3).join(', ');

        return `
            <div class="admin-song-item">
                <div class="admin-song-main">
                    <div class="admin-song-title">${s.title}</div>
                    <div class="admin-song-meta">${s.artist} | ${s.genre} | ${sizeMB} | ${age}</div>
                    <div class="admin-song-tags">${tags}</div>
                </div>
                <div class="admin-song-hearts">
                    <span class="admin-global-hearts ${s.globalHearts <= 0 ? 'negative' : ''}">${s.globalHearts} ♥</span>
                    <div class="admin-hearts-detail">${heartsDetail}</div>
                </div>
                <button class="admin-delete-btn" onclick="adminDeleteSong('${s.id}')" title="Borrar">✕</button>
            </div>`;
    }).join('');
}

function toggleAdminUserFilter(userId) {
    if (adminData.filters.users.has(userId)) adminData.filters.users.delete(userId);
    else adminData.filters.users.add(userId);
    rerenderAdmin();
}

function toggleAdminTagFilter(tag) {
    if (adminData.filters.tags.has(tag)) adminData.filters.tags.delete(tag);
    else adminData.filters.tags.add(tag);
    rerenderAdmin();
}

function rerenderAdmin() {
    // Re-render users
    document.querySelectorAll('.admin-user-card').forEach(card => {
        const uid = parseInt(card.getAttribute('onclick').match(/\d+/)[0]);
        card.classList.toggle('active', adminData.filters.users.has(uid));
    });
    // Re-render tags
    const tagsCloud = document.getElementById('admin-tags-cloud');
    if (tagsCloud) tagsCloud.innerHTML = renderAdminTagCloud();
    // Re-render songs
    const songsList = document.getElementById('admin-songs-list');
    if (songsList) songsList.innerHTML = renderAdminSongs();
}

async function adminDeleteSong(songId) {
    const song = adminData.songs.find(s => s.id === songId);
    if (!confirm(`Borrar "${song?.title || songId}"?`)) return;

    try {
        const res = await fetch('api/admin.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ songId })
        });
        const data = await res.json();
        if (data.success) {
            adminData.songs = adminData.songs.filter(s => s.id !== songId);
            rerenderAdmin();
            showToast('Borrada: ' + (song?.title || songId));
        }
    } catch (e) { showToast('Error borrando'); }
}

async function adminCleanup() {
    const orphans = adminData.songs.filter(s => s.globalHearts <= 0);
    if (orphans.length === 0) { showToast('No hay canciones sin corazones'); return; }
    if (!confirm(`Borrar ${orphans.length} canciones con 0 o menos corazones?`)) return;

    let deleted = 0;
    for (const s of orphans) {
        try {
            const res = await fetch('api/admin.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                body: JSON.stringify({ songId: s.id })
            });
            const data = await res.json();
            if (data.success) {
                adminData.songs = adminData.songs.filter(x => x.id !== s.id);
                deleted++;
            }
        } catch (e) {}
    }
    rerenderAdmin();
    showToast(`Borradas ${deleted} canciones`);
}

function closeAdminPanel() {
    document.getElementById('admin-panel-wrap')?.remove();
}

// === Android Auto Info ===
function showAndroidAutoInfo() {
    const overlay = document.createElement('div');
    overlay.className = 'error-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="android-auto-info-modal">
            <h2>🚗 Android Auto</h2>
            <p style="color:var(--text-muted);margin-bottom:16px;">ChemPlay es compatible con Android Auto. Controla tu musica desde la pantalla del coche.</p>

            <div class="aa-feature-list">
                <div class="aa-feature">♥ <strong>Me gusta / No me gusta</strong> — Vota canciones desde el coche</div>
                <div class="aa-feature">🎲 <strong>Al azar</strong> — Salta a cancion aleatoria</div>
                <div class="aa-feature">✨ <strong>Sorpresa</strong> — Busca cancion popular nueva</div>
                <div class="aa-feature">🎤 <strong>Busqueda por voz</strong> — "Pon rock" o "Pon Coldplay"</div>
                <div class="aa-feature">🏷️ <strong>Etiquetas</strong> — Navega por genero, fuente, estilo</div>
                <div class="aa-feature">🏆 <strong>Top valoradas</strong> — Tus canciones con mas corazones</div>
                <div class="aa-feature">⚡ <strong>Sin cortes</strong> — Siguiente cancion precargada</div>
                <div class="aa-feature">🔒 <strong>Pantalla bloqueada</strong> — Controles siempre visibles</div>
            </div>

            <h3 style="margin-top:20px;">Activar modo desarrollador en Android Auto</h3>
            <ol class="aa-steps">
                <li>Abre la app <strong>Android Auto</strong> en tu telefono</li>
                <li>Ve a <strong>Ajustes</strong> (engranaje arriba a la derecha)</li>
                <li>Baja hasta <strong>Version</strong> y pulsa <strong>10 veces</strong> seguidas</li>
                <li>Aparece el menu <strong>"Ajustes para desarrolladores"</strong></li>
                <li>Activa <strong>"Fuentes desconocidas"</strong> para permitir apps no verificadas</li>
                <li>Reinicia Android Auto</li>
                <li>ChemPlay aparecera en la lista de apps del coche</li>
            </ol>

            <p style="color:var(--text-muted);font-size:12px;margin-top:12px;">Nota: Tambien puedes probar sin coche usando la app <strong>"Android Auto para pantallas de telefono"</strong> o el emulador <strong>Desktop Head Unit (DHU)</strong> de Android Studio.</p>

            <button class="whats-new-close" onclick="this.closest('.error-modal-overlay').remove()">Entendido</button>
        </div>`;
    document.body.appendChild(overlay);
}

// === Al Azar (saltar a canción aleatoria de la cola) ===
async function playRandom() {
    const songs = await getAllSongs();
    if (!songs || songs.length <= 1) { showToast("No hay suficientes canciones"); return; }
    // Elegir aleatoria diferente a la actual
    let pick;
    let attempts = 0;
    do {
        pick = songs[Math.floor(Math.random() * songs.length)];
        attempts++;
    } while (pick.id === currentSong?.id && attempts < 20);
    showToast(`🎲 ${pick.title}`);
    await tryPlaySong(pick);
    updateHeartsDisplay();
}

// === Discover (Sorpresa) ===
function discoverNew() {
    if (isLoading) return;
    const overlay = document.createElement('div');
    overlay.className = 'error-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="discover-modal">
            <div class="discover-modal-title">Sorpresa: descarga al azar de...</div>
            <button class="discover-option suno" onclick="this.closest('.error-modal-overlay').remove(); discoverFromSuno();">
                <span class="discover-option-icon">🤖</span>
                <span>Suno AI</span>
                <span class="discover-option-desc">Canciones IA populares</span>
            </button>
            <button class="discover-option youtube" onclick="this.closest('.error-modal-overlay').remove(); discoverFromYouTube();">
                <span class="discover-option-icon">📺</span>
                <span>YouTube</span>
                <span class="discover-option-desc">Top vistas, descarga auto</span>
            </button>
            <button class="discover-option torrent" onclick="this.closest('.error-modal-overlay').remove(); discoverFromTorrent();">
                <span class="discover-option-icon">🧲</span>
                <span>Torrent</span>
                <span class="discover-option-desc">Top seeders, descarga auto</span>
            </button>
        </div>`;
    document.body.appendChild(overlay);
}

async function discoverFromSuno() {
    const genre = selectedGenreFilter || wheelGenres[Math.floor(Math.random() * wheelGenres.length)];
    currentGenre = genre;
    showToast(`🔎 Buscando ${genre} en Suno...`);

    let tracks = await fetchSunoTracks(genre);
    let source = 'Suno AI';

    if (!tracks || tracks.length === 0) {
        tracks = await fetchJamendoTracks(genre);
        source = 'Jamendo';
    }

    if (!tracks || tracks.length === 0) {
        tracks = await fetchSunoTracks('');
        source = 'Suno AI';
    }

    if (tracks && tracks.length > 0) {
        const pick = tracks[Math.floor(Math.random() * tracks.length)];
        const song = {
            id: pick.id,
            title: pick.title,
            artist: pick.artist || source,
            url: pick.audio || pick.url,
            thumb: pick.thumb,
            genre: genre,
            source: source
        };
        showToast(`🎲 ${genre.charAt(0).toUpperCase() + genre.slice(1)} — ${source}`);
        const success = await tryPlaySong(song);
        if (!success) playDemoFallback(genre);
    } else {
        playDemoFallback(genre);
    }
}

async function discoverFromYouTube() {
    showYouTubeProgress('Buscando cancion popular en YouTube...');
    try {
        const res = await fetch('api/surprise.php?source=youtube');
        const data = await res.json();
        if (!data.success || !data.track) {
            hideYouTubeProgress();
            showToast('No se encontro nada en YouTube, reintenta');
            return;
        }
        const t = data.track;
        showToast(`🎲 YouTube: ${t.title.substring(0, 40)}...`);
        hideYouTubeProgress();
        // Auto-download the picked track
        downloadFromYouTube(t.url);
    } catch (e) {
        hideYouTubeProgress();
        showToast('Error buscando en YouTube');
    }
}

async function discoverFromTorrent() {
    showYouTubeProgress('Buscando torrent popular...');
    try {
        const res = await fetch('api/surprise.php?source=torrent');
        const data = await res.json();
        if (!data.success || !data.track) {
            hideYouTubeProgress();
            showToast('No se encontraron torrents, reintenta');
            return;
        }
        const t = data.track;
        hideYouTubeProgress();
        showToast(`🧲 Torrent: ${t.title.substring(0, 40)}... (${t.size})`);
        // Auto-download the picked torrent
        downloadTorrent(encodeURIComponent(t.magnet), t.title.replace(/'/g, "\\'"));
    } catch (e) {
        hideYouTubeProgress();
        showToast('Error buscando torrents');
    }
}

function playDemoFallback(genre) {
    const demo = demoTracks[Math.floor(Math.random() * demoTracks.length)];
    const song = { id: demo.id, title: demo.title, artist: demo.artist, url: demo.url, genre: "Demo", thumb: demo.thumb };
    showToast(`🎲 ${genre} — modo local`);
    tryPlaySong(song);
}

// === Position State for Media Session (lock screen seek bar) ===
function updatePositionState() {
    if ('mediaSession' in navigator && mainAudio.duration && isFinite(mainAudio.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: mainAudio.duration,
                playbackRate: mainAudio.playbackRate,
                position: Math.min(mainAudio.currentTime, mainAudio.duration)
            });
        } catch (e) { /* not supported */ }
    }
}

// === Keyboard Controls ===
function initKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        // No capturar si está escribiendo en un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                handlePlayPause();
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) {
                    playNext(true); // Shift+Right = siguiente cancion
                } else {
                    seekForward(10); // Right = avanzar 10s
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    playPrev(); // Shift+Left = cancion anterior
                } else {
                    seekBackward(10); // Left = retroceder 10s
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                volumeUp();
                break;
            case 'ArrowDown':
                e.preventDefault();
                volumeDown();
                break;
            case 'KeyM':
                e.preventDefault();
                toggleMute();
                break;
            case 'KeyN':
                e.preventDefault();
                playNext(true);
                break;
            case 'KeyP':
                e.preventDefault();
                playPrev();
                break;
            case 'KeyS':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    handleStop();
                }
                break;
            case 'Escape':
                closeSearch();
                closeGenreMenu();
                break;
            // Teclas multimedia del teclado (MediaKeys)
            case 'MediaPlayPause':
                e.preventDefault();
                handlePlayPause();
                break;
            case 'MediaTrackNext':
                e.preventDefault();
                playNext(true);
                break;
            case 'MediaTrackPrevious':
                e.preventDefault();
                playPrev();
                break;
            case 'MediaStop':
                e.preventDefault();
                handleStop();
                break;
        }
    });
}

// === YouTube Download ===
function isYouTubeUrl(text) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|m\.youtube\.com)\//i.test(text);
}

function showYouTubeProgress(msg) {
    let overlay = document.getElementById('yt-progress-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'yt-progress-overlay';
        overlay.className = 'yt-progress-overlay';
        overlay.innerHTML = `
            <div class="yt-progress-spinner"></div>
            <div class="yt-progress-text" id="yt-progress-text"></div>
        `;
        const artwork = document.querySelector('.artwork-container');
        if (artwork) artwork.appendChild(overlay);
        else document.body.appendChild(overlay);
    }
    document.getElementById('yt-progress-text').textContent = msg || 'Descargando...';
    overlay.style.display = 'flex';
}

function hideYouTubeProgress() {
    const overlay = document.getElementById('yt-progress-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showErrorModal(msg) {
    const existing = document.getElementById('error-modal-overlay');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'error-modal-overlay';
    div.className = 'error-modal-overlay';
    div.innerHTML = `
        <div class="error-modal">
            <div class="error-modal-icon">&#x26A0;&#xFE0F;</div>
            <div class="error-modal-title">Error de descarga</div>
            <div class="error-modal-msg">${msg}</div>
            <button class="error-modal-btn" onclick="this.closest('.error-modal-overlay').remove()">Aceptar</button>
        </div>`;
    document.body.appendChild(div);
}

async function downloadFromYouTube(url) {
    showYouTubeProgress('Iniciando descarga...');
    try {
        const startRes = await fetch('api/youtube_download.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const startData = await startRes.json();
        if (!startData.success) {
            hideYouTubeProgress();
            showErrorModal(startData.error || 'Error al iniciar descarga');
            return;
        }
        const jobId = startData.jobId;
        showYouTubeProgress('Descargando audio...');

        // Poll every 2s
        let attempts = 0;
        const poll = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch('api/youtube_download.php?jobId=' + jobId);
                const data = await res.json();
                if (data.status === 'complete' && data.song) {
                    clearInterval(poll);
                    hideYouTubeProgress();
                    showToast('YouTube descargado: ' + data.song.title);
                    await tryPlaySong(data.song);
                    updateHeartsDisplay();
                    updateStorageStats();
                } else if (data.status === 'error') {
                    clearInterval(poll);
                    hideYouTubeProgress();
                    showErrorModal(data.error || 'Error en descarga YouTube');
                } else {
                    const pct = Math.min(95, Math.round((attempts / 90) * 100));
                    showYouTubeProgress(`Descargando... ${pct}%`);
                }
                if (attempts >= 90) {
                    clearInterval(poll);
                    hideYouTubeProgress();
                    showErrorModal('Timeout: la descarga tardó demasiado (3 min)');
                }
            } catch (e) { /* keep polling */ }
        }, 2000);
    } catch (e) {
        hideYouTubeProgress();
        showErrorModal('Error de conexión al servidor');
    }
}

// === YouTube Search ===
async function searchYouTube(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    // Replace the button with loading
    const btn = resultsContainer.querySelector('.yt-search-btn');
    if (btn) btn.outerHTML = '<div class="yt-search-loading" style="text-align:center;color:#ef4444;padding:12px;font-size:13px;">Buscando en YouTube...</div>';

    try {
        const res = await fetch('api/youtube_search.php?q=' + encodeURIComponent(query) + '&limit=8');
        const results = await res.json();

        const loading = resultsContainer.querySelector('.yt-search-loading');
        if (loading) loading.remove();

        if (!results || results.length === 0 || results.error) {
            resultsContainer.insertAdjacentHTML('beforeend',
                '<p style="text-align:center;color:#ef4444;padding:12px;font-size:12px;">No se encontraron resultados en YouTube</p>');
            return;
        }

        let html = '<div class="yt-section-header">Resultados YouTube</div>';
        results.forEach(r => {
            const urlSafe = r.url.replace(/'/g, "\\'");
            const verified = r.verified ? ' ✓' : '';
            html += `
                <div class="search-result-item yt-result" onclick="downloadFromYouTube('${urlSafe}'); closeSearch();">
                    <img class="search-result-thumb" src="${r.thumb}" alt="" onerror="this.src='icon.png'">
                    <div class="search-result-info">
                        <div class="search-result-title">${r.title}</div>
                        <div class="search-result-artist">${r.artist}${verified} <span class="search-badge yt">YouTube</span></div>
                        <div class="yt-result-meta">${r.viewsStr} vistas · ${r.durationStr}</div>
                    </div>
                </div>`;
        });
        resultsContainer.insertAdjacentHTML('beforeend', html);
    } catch (e) {
        const loading = resultsContainer.querySelector('.yt-search-loading');
        if (loading) loading.outerHTML = '<p style="text-align:center;color:#ef4444;padding:12px;font-size:12px;">Error buscando en YouTube</p>';
    }
}

// === Torrent Search & Download ===
let activeTorrentPolls = {};

async function searchTorrents(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    const loadingHtml = '<div class="torrent-loading" style="text-align:center;color:#f97316;padding:12px;font-size:13px;">Buscando en red torrent...</div>';
    resultsContainer.insertAdjacentHTML('beforeend', loadingHtml);

    try {
        const res = await fetch('api/torrent_search.php?q=' + encodeURIComponent(query) + '&limit=10');
        const results = await res.json();

        const loading = resultsContainer.querySelector('.torrent-loading');
        if (loading) loading.remove();

        if (!results || results.length === 0) {
            resultsContainer.insertAdjacentHTML('beforeend',
                '<p style="text-align:center;color:#f97316;padding:12px;font-size:12px;">No se encontraron torrents</p>');
            return;
        }

        let html = '<div class="torrent-section-header">Resultados Torrent</div>';
        results.forEach(r => {
            const magnetEncoded = encodeURIComponent(r.magnet);
            const titleSafe = (r.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <div class="search-result-item torrent-result">
                    <div class="torrent-icon" onclick="downloadTorrent('${magnetEncoded}', '${titleSafe}')">&#x2B07;</div>
                    <div class="search-result-info" onclick="downloadTorrent('${magnetEncoded}', '${titleSafe}')">
                        <div class="search-result-title">${r.title}</div>
                        <div class="search-result-artist">
                            ${r.size || ''}
                            ${r.seeders ? ' <span class="seed-count">&#x25B2; ' + r.seeders + ' seeds</span>' : ''}
                            <span class="search-badge torrent">${r.source}</span>
                        </div>
                    </div>
                </div>`;
        });

        resultsContainer.insertAdjacentHTML('beforeend', html);
    } catch (e) {
        const loading = resultsContainer.querySelector('.torrent-loading');
        if (loading) loading.remove();
        resultsContainer.insertAdjacentHTML('beforeend',
            '<p style="text-align:center;color:#ef4444;padding:12px;font-size:12px;">Error buscando torrents</p>');
    }
}

// Progress is only shown in the search modal downloads list
function showTorrentProgress(title, status, progress, details) {
    // No-op: progress shown only via search popup polling
    updateDownloadBadge(Object.keys(activeTorrentPolls).length);
}

function hideTorrentProgress() {
    updateDownloadBadge(Object.keys(activeTorrentPolls).length);
}

async function downloadTorrent(encodedMagnet, title) {
    const magnet = decodeURIComponent(encodedMagnet);
    closeSearch();
    showToast('Descarga iniciada: ' + (title || 'Torrent').substring(0, 40));
    updateDownloadBadge(Object.keys(activeTorrentPolls).length + 1);

    try {
        const res = await fetch('api/torrent_download.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({magnet, title})
        });
        const data = await res.json();
        if (!data.success) {
            hideTorrentProgress();
            showToast(data.error || 'Error al iniciar descarga');
            return;
        }

        const jobId = data.jobId;
        let attempts = 0;

        // Polling
        activeTorrentPolls[jobId] = setInterval(async () => {
            attempts++;
            try {
                const sr = await fetch('api/torrent_download.php?jobId=' + jobId);
                const s = await sr.json();

                if (s.status === 'complete') {
                    clearInterval(activeTorrentPolls[jobId]);
                    delete activeTorrentPolls[jobId];
                    hideTorrentProgress();

                    if (s.song) {
                        // Reload library to pick up new songs
                        if (typeof loadSavedSongs === 'function') await loadSavedSongs();
                        playSong(s.song);
                        const total = s.totalSongs || 1;
                        showToast(total > 1 ? total + ' canciones descargadas' : 'Descarga completada');
                        updateStorageStats();
                    }
                } else if (s.status === 'error') {
                    clearInterval(activeTorrentPolls[jobId]);
                    delete activeTorrentPolls[jobId];
                    hideTorrentProgress();
                    showToast(s.error || 'Error en descarga torrent');
                } else {
                    let details = '';
                    if (s.downloaded && s.total) details = s.downloaded + ' / ' + s.total;
                    if (s.speed) details += ' @ ' + s.speed + '/s';
                    showTorrentProgress(title, s.status, s.progress || 0, details);
                }

                // Safety: 200 attempts = ~10 min
                if (attempts >= 200) {
                    clearInterval(activeTorrentPolls[jobId]);
                    delete activeTorrentPolls[jobId];
                    hideTorrentProgress();
                    showToast('Timeout descarga torrent');
                    try { await fetch('api/torrent_download.php?cancel=' + jobId); } catch(e) {}
                }
            } catch (e) { /* keep polling */ }
        }, 3000);

    } catch (e) {
        hideTorrentProgress();
        showToast('Error de conexion');
    }
}

// Legacy fallback
function openMagnet(encodedMagnet) {
    downloadTorrent(encodedMagnet, 'Torrent');
}

function updateDownloadBadge(count) {
    const badge = document.getElementById('dl-count');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

// Resume active torrent downloads after page reload
async function resumeActiveDownloads() {
    try {
        const res = await fetch('api/torrent_download.php?list');
        const data = await res.json();
        if (!data.success || !data.jobs || data.jobs.length === 0) {
            updateDownloadBadge(0);
            return;
        }
        updateDownloadBadge(data.jobs.length);

        // Resume polling for each active job
        data.jobs.forEach(job => {
            const jobId = job.jobId;
            const title = job.title || 'Torrent';
            if (activeTorrentPolls[jobId]) return; // Already polling

            showTorrentProgress(title, job.status, job.progress || 0, '');

            // Cancel button
            const cancelBtn = document.getElementById('torrent-cancel-btn');
            if (cancelBtn) {
                cancelBtn.onclick = async () => {
                    if (activeTorrentPolls[jobId]) clearInterval(activeTorrentPolls[jobId]);
                    delete activeTorrentPolls[jobId];
                    hideTorrentProgress();
                    try { await fetch('api/torrent_download.php?cancel=' + jobId); } catch(e) {}
                    showToast('Descarga cancelada');
                };
            }

            let attempts = 0;
            activeTorrentPolls[jobId] = setInterval(async () => {
                attempts++;
                try {
                    const sr = await fetch('api/torrent_download.php?jobId=' + jobId);
                    const s = await sr.json();

                    if (s.status === 'complete') {
                        clearInterval(activeTorrentPolls[jobId]);
                        delete activeTorrentPolls[jobId];
                        hideTorrentProgress();
                        if (s.song) {
                            if (typeof loadSavedSongs === 'function') await loadSavedSongs();
                            playSong(s.song);
                            showToast(s.totalSongs > 1 ? s.totalSongs + ' canciones descargadas' : 'Descarga completada');
                            updateStorageStats();
                        }
                    } else if (s.status === 'error') {
                        clearInterval(activeTorrentPolls[jobId]);
                        delete activeTorrentPolls[jobId];
                        hideTorrentProgress();
                        showToast(s.error || 'Error en descarga torrent');
                    } else {
                        let details = '';
                        if (s.downloaded && s.total) details = s.downloaded + ' / ' + s.total;
                        if (s.speed) details += ' @ ' + s.speed + '/s';
                        showTorrentProgress(title, s.status, s.progress || 0, details);
                    }

                    if (attempts >= 200) {
                        clearInterval(activeTorrentPolls[jobId]);
                        delete activeTorrentPolls[jobId];
                        hideTorrentProgress();
                    }
                } catch (e) { /* keep polling */ }
            }, 3000);
        });
    } catch (e) { /* ignore */ }
}

// === Handle URL params (from share-receiver redirect) ===
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // ?play=songId - play a specific song from library
    const playId = params.get('play');
    if (playId) {
        window.history.replaceState({}, '', window.location.pathname);
        getAllSongs().then(songs => {
            const song = songs.find(s => s.id === playId);
            if (song) {
                tryPlaySong(song).then(() => updateHeartsDisplay());
            } else {
                showToast('Cancion no encontrada');
            }
        });
        return true;
    }

    // ?playUrl=url - play a direct audio URL
    const playUrl = params.get('playUrl');
    if (playUrl) {
        window.history.replaceState({}, '', window.location.pathname);
        const song = { id: 'url-' + Date.now(), title: 'Audio compartido', artist: 'Compartido', url: playUrl, thumb: 'icon.png', genre: 'Compartido' };
        tryPlaySong(song).then(() => updateHeartsDisplay());
        return true;
    }

    // ?ytdl=url - download YouTube
    const ytdl = params.get('ytdl');
    if (ytdl) {
        window.history.replaceState({}, '', window.location.pathname);
        downloadFromYouTube(ytdl);
        return true;
    }

    return false;
}

// === Pull-to-Refresh ===
function initPullToRefresh() {
    let startY = 0;
    let pulling = false;
    let indicator = null;
    const threshold = 80;

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && !document.getElementById('ranking-panel') && !document.getElementById('search-overlay')?.classList.contains('active')) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - startY;
        if (dy < 0) { pulling = false; removeIndicator(); return; }
        if (dy > 10) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'pull-refresh-indicator';
                indicator.className = 'pull-refresh-indicator';
                document.body.appendChild(indicator);
            }
            const progress = Math.min(dy / threshold, 1);
            indicator.style.transform = `translateY(${Math.min(dy * 0.5, 60)}px)`;
            indicator.style.opacity = progress;
            indicator.textContent = progress >= 1 ? '↻ Soltar para actualizar' : '↓ Arrastra para actualizar';
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        const ind = document.getElementById('pull-refresh-indicator');
        if (ind && ind.textContent.includes('Soltar')) {
            ind.textContent = '↻ Actualizando...';
            refreshApp().then(() => removeIndicator());
        } else {
            removeIndicator();
        }
    });

    function removeIndicator() {
        const ind = document.getElementById('pull-refresh-indicator');
        if (ind) { ind.style.opacity = '0'; setTimeout(() => ind.remove(), 200); }
        indicator = null;
    }
}

async function refreshApp() {
    showToast('↻ Actualizando...');
    try {
        unifiedHearts = await loadHeartsFromServer();
        updateHeartsDisplay();
        updateStorageStats();
        // Refrescar ranking si está abierto
        const panel = document.getElementById('ranking-panel');
        if (panel) { panel.remove(); await openRanking(); }
        showToast('Actualizado');
    } catch (e) {
        showToast('Error al actualizar');
    }
}

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
    // Init Google Sign-In
    initGoogleSignIn();

    // Check app version first (native app only), then show login if needed
    const savedToken = localStorage.getItem('sunoplay-auth-token');
    if (!savedToken) {
        const updateData = await checkAppVersion();
        if (updateData) {
            showUpdateModal(updateData);
            // Login modal will show after user dismisses update (unless force_update)
        } else {
            showWelcomeModal();
        }
    } else {
        // User already logged in — show What's New if there are new features
        showWhatsNew();
    }

    // Auth button (header) - muestra modal para login o logout
    document.getElementById('auth-btn')?.addEventListener('click', () => {
        if (currentUser) {
            if (confirm('¿Cerrar sesión?')) logout();
        } else {
            showWelcomeModal();
        }
    });

    // User info click -> logout
    document.getElementById('user-info')?.addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) logout();
    });

    // Admin panel
    document.getElementById('admin-btn')?.addEventListener('click', openAdminPanel);

    // Load hearts
    unifiedHearts = await loadHeartsFromServer();

    // Playback controls
    playPauseBtn?.addEventListener('click', handlePlayPause);
    document.getElementById('stop-btn')?.addEventListener('click', handleStop);
    document.getElementById('next-btn')?.addEventListener('click', () => playNext(true));
    document.getElementById('prev-btn')?.addEventListener('click', playPrev);
    document.getElementById('save-btn')?.addEventListener('click', handleSaveBtn);
    document.getElementById('surprise-btn')?.addEventListener('click', discoverNew);
    document.getElementById('random-btn')?.addEventListener('click', playRandom);

    // Vote controls
    document.getElementById('vote-like')?.addEventListener('click', () => handleVote('like'));
    document.getElementById('vote-dislike')?.addEventListener('click', () => handleVote('dislike'));

    // Genre & Ranking
    document.getElementById('genre-menu-btn')?.addEventListener('click', openGenreMenu);
    document.getElementById('library-btn')?.addEventListener('click', toggleRanking);

    // Volume
    document.getElementById('volume-icon-btn')?.addEventListener('click', () => {
        mainAudio.muted = !mainAudio.muted;
        updateVolumeUI();
    });

    // Audio ended -> +1 heart and next (only for web/PWA — native handles via nativeBridge.onEvent)
    if (!isNativeApp) {
        mainAudio.addEventListener('ended', () => handleVote('like', true));

        // Global error handler: if audio fails mid-playback, skip to next
        mainAudio.addEventListener('error', () => {
            if (isPlaying && currentSong && !isLoading) {
                isPlaying = false;
                updatePlayerUI();
                showToast("Error de audio. Saltando...");
                setTimeout(() => playNext(false), 1500);
            }
        });

        // Stalled handler: if audio stalls for too long, try to recover
        let stallTimer = null;
        mainAudio.addEventListener('stalled', () => {
            if (!isPlaying || isLoading) return;
            stallTimer = setTimeout(() => {
                if (isPlaying && mainAudio.paused && currentSong) {
                    mainAudio.load();
                    mainAudio.play().catch(() => {
                        isPlaying = false;
                        updatePlayerUI();
                        showToast("Conexión perdida. Saltando...");
                        setTimeout(() => playNext(false), 1500);
                    });
                }
            }, 5000);
        });
        mainAudio.addEventListener('playing', () => {
            if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
        });
    }

    // Show version & platform in footer
    const footerCredit = document.getElementById('footer-credit');
    if (footerCredit) {
        let platform = 'Web';
        let ver = APP_VERSION;
        if (isNativeApp) {
            const uaMatch = navigator.userAgent.match(/SunoPlayApp\/([\d.]+)/);
            ver = uaMatch ? uaMatch[1] : ver;
            // Detect Android Auto (connected via MediaBrowserService)
            platform = 'Android';
        }
        footerCredit.textContent = `ChemaDev · v${ver} · ${platform}`;
    }

    // Pass auth token to native bridge
    if (isNativeApp && window.AndroidBridge && authToken) {
        try { AndroidBridge.setAuthToken(authToken); } catch (e) {}
    }

    // Sync native state if app was already playing before WebView loaded
    if (isNativeApp && window.AndroidBridge) {
        try {
            const stateJson = AndroidBridge.getCurrentState();
            if (stateJson) {
                const st = JSON.parse(stateJson);
                if (st.state === 'playing' || st.state === 'paused') {
                    currentSong = { id: st.mediaId || '', title: st.title || '', artist: st.artist || '', url: '', thumb: st.artUri || 'icon.png', genre: '' };
                    isPlaying = st.state === 'playing';
                    nativeState.position = (st.position || 0) / 1000;
                    nativeState.duration = (st.duration || 0) / 1000;
                    playerTitle.textContent = st.title || 'ChemPlay';
                    playerArtist.textContent = st.artist || '';
                    if (st.artUri) playerThumb.src = st.artUri;
                    updatePlayerUI();
                    updateNativeSeekBar();
                    updateHeartsDisplay();
                }
            }
        } catch (e) { /* no state yet */ }
    }

    // Search
    playerTitle?.addEventListener('click', openSearch);
    document.getElementById('search-btn')?.addEventListener('click', openSearch);
    document.getElementById('close-search-btn')?.addEventListener('click', closeSearch);
    document.getElementById('search-input')?.addEventListener('input', (e) => performSearch(e.target.value));
    document.getElementById('search-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'search-overlay') closeSearch();
    });

    // Genre click -> persist filter
    playerGenreEl?.addEventListener('click', () => {
        if (currentSong && currentSong.genre) {
            selectGenre(currentSong.genre);
            animateClick(playerGenreEl);
        }
    });

    // Init subsystems
    initSeekBar();
    initVolume();
    initKeyboardControls();
    initAndroidBanner();
    updateStorageStats();

    // Handle URL params from share-receiver redirects
    handleUrlParams();

    // Resume any active torrent downloads (survives page reload)
    resumeActiveDownloads();

    // Actualizar positionState periódicamente para lock screen / Bluetooth
    mainAudio.addEventListener('timeupdate', updatePositionState);
    mainAudio.addEventListener('durationchange', updatePositionState);

    // Pull-to-refresh
    initPullToRefresh();
});

// === Android APK Download Banner ===
function initAndroidBanner() {
    // Solo mostrar en Android, no en standalone (ya instalada) y si no fue descartado recientemente
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const dismissed = localStorage.getItem('sunoplay-apk-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (!isAndroid || isStandalone || (Date.now() - dismissedTime < sevenDays)) return;

    // Esperar 3 segundos antes de mostrar
    setTimeout(() => {
        const banner = document.createElement('div');
        banner.id = 'android-banner';
        banner.className = 'android-banner';
        banner.innerHTML = `
            <div class="android-banner-icon">📱</div>
            <div class="android-banner-text">
                <strong>ChemPlay para Android</strong>
                <span>App nativa con Android Auto y controles Bluetooth</span>
            </div>
            <a href="chemplay-v3.4.0.apk" class="android-banner-btn" download="ChemPlay-v3.4.0.apk">Descargar</a>
            <button class="android-banner-close" id="android-banner-close">&times;</button>
        `;
        document.body.appendChild(banner);

        requestAnimationFrame(() => banner.classList.add('visible'));

        document.getElementById('android-banner-close').addEventListener('click', () => {
            banner.classList.remove('visible');
            localStorage.setItem('sunoplay-apk-dismissed', Date.now().toString());
            setTimeout(() => banner.remove(), 400);
        });
    }, 3000);
}
