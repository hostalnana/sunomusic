// === SunoPlay Premium v32 — Per-User System ===

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

// === Google Sign-In ===
function initGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleSignIn, 500);
        return;
    }
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: true
    });

    const btnContainer = document.getElementById('google-signin-btn');
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

    // Auto-login si tiene token guardado
    const savedToken = localStorage.getItem('sunoplay-auth-token');
    if (savedToken) {
        authToken = savedToken;
        const savedUser = JSON.parse(localStorage.getItem('sunoplay-user') || 'null');
        if (savedUser) {
            currentUser = savedUser;
            showUserLoggedIn();
            hideWelcomeModal();
        }
    }
}

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
    } else if (authBtn) {
        authBtn.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
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
}

function closeSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    if (!overlay) return;
    overlay.classList.remove('active');
    input.value = '';
    document.getElementById('search-results').innerHTML = '';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

async function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    if (query.length < 3) return;

    resultsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px;">Buscando...</p>';

    const q = query.toLowerCase();

    // 1. Resultados locales
    const allSongs = await getAllSongs();
    const localResults = allSongs.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.genre || '').toLowerCase().includes(q)
    ).slice(0, 6).map(s => ({ ...s, source: 'local' }));

    // 2. Resultados de API (Suno + Jamendo)
    let apiResults = [];
    try {
        const resp = await fetch(`api/search.php?q=${encodeURIComponent(query)}&limit=8`);
        if (resp.ok) {
            const data = await resp.json();
            // Normalizar campos: la API usa 'url', la app usa 'url'
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

    if (merged.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No se encontraron resultados</p>';
        return;
    }

    const sourceBadge = (source) => {
        if (source === 'local') return '<span class="search-badge local">📚 Local</span>';
        if (source === 'suno') return '<span class="search-badge suno">🔥 Suno</span>';
        return '<span class="search-badge jamendo">🎵 Jamendo</span>';
    };

    resultsContainer.innerHTML = merged.map(s => {
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
        timeCurrentEl.textContent = formatTime(pct * mainAudio.duration);
    };
    const endSeek = (e) => {
        if (!isSeeking) return;
        isSeeking = false;
        const rect = seekBar.getBoundingClientRect();
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        mainAudio.currentTime = pct * mainAudio.duration;
        requestAnimationFrame(updateSeekBar);
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
        mainAudio.volume = getPos(e);
        mainAudio.muted = false;
        localStorage.setItem('sunoplay-volume', mainAudio.volume);
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

    // Lógica de borrado/quitado
    if (hearts <= 0) {
        showToast("🚫 Quitada de la lista");
        if (result && result.deleted) {
            showToast("🔥 ¡Borrada! (Votos globales <= 0)");
            delete unifiedHearts[songId];
        }
        currentSong = null; // Evitar bucles limpiando la canción actual
        setTimeout(() => playNext(false), 2000);
        return;
    }

    updateHeartsDisplay();

    // Si viene de una escucha completa (ended), pasar a la siguiente sin votar otra vez
    if (isAuto && type === "like") {
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

async function playNext(doVote = true) {
    if (isLoading) return;

    // Si es un salto (manual o auto) y pedimos computar voto
    if (currentSong && doVote) {
        await handleVote('dislike', true);
        return;
    }

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
    } else if (mainAudio.currentTime > 3) {
        mainAudio.currentTime = 0;
    }
}

async function tryPlaySong(song) {
    if (isLoading) return false;
    isLoading = true;
    currentSong = song;

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

    let success = await tryUrl(song.url);
    let playedSong = song;

    if (!success) {
        const libSongs = await getAllSongs();
        if (libSongs.length > 0) {
            const random = libSongs[Math.floor(Math.random() * libSongs.length)];
            success = await tryUrl(random.url, 3000);
            if (success) playedSong = random;
        }
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
            artwork: currentSong.thumb ? [{ src: currentSong.thumb, sizes: '512x512', type: 'image/png' }] : []
        });
        navigator.mediaSession.setActionHandler('play', handlePlayPause);
        navigator.mediaSession.setActionHandler('pause', handlePlayPause);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    }
}

function handlePlayPause() {
    if (!currentSong) { playNext(); return; }
    animateClick(playPauseBtn);
    if (isPlaying) {
        mainAudio.pause();
        isPlaying = false;
    } else {
        mainAudio.play().catch(() => { });
        isPlaying = true;
        requestAnimationFrame(updateSeekBar);
    }
    updatePlayerUI();
}

function handleStop() {
    mainAudio.pause();
    mainAudio.currentTime = 0;
    isPlaying = false;
    if (seekFill) seekFill.style.width = '0%';
    if (timeCurrentEl) timeCurrentEl.textContent = '0:00';
    updatePlayerUI();
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

async function openRanking() {
    const songs = await getAllSongs();
    if (!songs || songs.length === 0) { showToast("Biblioteca vacía"); return; }

    const withHearts = songs.map(s => ({ ...s, hearts: unifiedHearts[s.id] ?? 0 }));

    const byGenre = {};
    withHearts.forEach(song => {
        const genre = song.genre || "Sin género";
        if (!byGenre[genre]) byGenre[genre] = { songs: [], totalHearts: 0 };
        byGenre[genre].songs.push(song);
        byGenre[genre].totalHearts += song.hearts;
    });

    Object.values(byGenre).forEach(g => g.songs.sort((a, b) => b.hearts - a.hearts));
    const sortedGenres = Object.entries(byGenre).sort((a, b) => b[1].totalHearts - a[1].totalHearts);

    let html = `
        <div id="ranking-panel" class="ranking-panel">
            <div class="ranking-handle" onclick="toggleRanking()"></div>
            <div class="ranking-header">
                <h2>🏆 ${currentUser ? currentUser.name.split(' ')[0] + ' — ' : ''}Ranking</h2>
                <span class="ranking-count">${withHearts.length} temas</span>
            </div>`;

    sortedGenres.forEach(([genre, data], idx) => {
        const groupId = `ranking-group-${idx}`;
        const isActive = selectedGenreFilter === genre;
        html += `
            <div class="ranking-group">
                <div class="ranking-genre-header${isActive ? ' active' : ''}" onclick="toggleRankingGroup('${groupId}')">
                    <span>🎵 ${genre} (${data.songs.length})</span>
                    <span style="display:flex;align-items:center;gap:8px;">
                        <span class="ranking-genre-hearts">❤️ ${data.totalHearts}</span>
                        <span class="ranking-chevron" id="chevron-${groupId}">▶</span>
                    </span>
                </div>
                <div class="ranking-songs-list collapsed" id="${groupId}">`;

        data.songs.forEach(s => {
            const songData = encodeURIComponent(JSON.stringify({
                id: s.id, title: s.title, artist: s.artist,
                url: s.url, thumb: s.thumb || 'icon.png', genre: s.genre
            }));
            html += `
                <div class="ranking-song">
                    <img class="ranking-thumb" src="${s.thumb || 'icon.png'}" alt="" onerror="this.src='icon.png'" onclick="playFromRanking('${songData}')">
                    <div class="ranking-song-info" onclick="playFromRanking('${songData}')">
                        <div class="ranking-song-title">${s.title}</div>
                        <div class="ranking-song-artist">${s.artist}</div>
                    </div>
                    <div class="ranking-song-hearts">${s.hearts >= 0 ? "❤️".repeat(Math.min(s.hearts, 5)) : "💔".repeat(Math.min(Math.abs(s.hearts), 5))} <span>${s.hearts}</span></div>
                    <button class="ranking-delete" onclick="event.stopPropagation();deleteFromRanking('${s.id}','${s.title.replace(/'/g, "\\'")}')">🗑️</button>
                </div>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    const panel = document.createElement("div");
    panel.innerHTML = html;
    document.body.appendChild(panel);
}

// === Discover (Sorpresa) ===
async function discoverNew() {
    if (isLoading) return;

    const genre = selectedGenreFilter || wheelGenres[Math.floor(Math.random() * wheelGenres.length)];
    currentGenre = genre;
    showToast(`🔎 Buscando ${genre}...`);

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

function playDemoFallback(genre) {
    const demo = demoTracks[Math.floor(Math.random() * demoTracks.length)];
    const song = { id: demo.id, title: demo.title, artist: demo.artist, url: demo.url, genre: "Demo", thumb: demo.thumb };
    showToast(`🎲 ${genre} — modo local`);
    tryPlaySong(song);
}

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
    // Init Google Sign-In
    initGoogleSignIn();

    // Si no hay sesión guardada, mostrar modal obligatorio
    const savedToken = localStorage.getItem('sunoplay-auth-token');
    if (!savedToken) {
        showWelcomeModal();
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

    // Load hearts
    unifiedHearts = await loadHeartsFromServer();

    // Playback controls
    playPauseBtn?.addEventListener('click', handlePlayPause);
    document.getElementById('stop-btn')?.addEventListener('click', handleStop);
    document.getElementById('next-btn')?.addEventListener('click', () => playNext(true));
    document.getElementById('prev-btn')?.addEventListener('click', playPrev);
    document.getElementById('save-btn')?.addEventListener('click', handleSaveBtn);
    document.getElementById('surprise-btn')?.addEventListener('click', discoverNew);

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

    // Audio ended -> +1 heart and next
    mainAudio.addEventListener('ended', () => handleVote('like', true));

    // Search
    playerTitle?.addEventListener('click', openSearch);
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
    updateStorageStats();
});
