const CACHE_NAME = 'cache-20260321-v310';

const AUDIO_CACHE_NAME = 'sunomusic-audio-v3';

const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app_v2.js',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Intercept POST to share-receiver (Web Share Target with files)
    if (url.pathname.includes('share-receiver') && request.method === 'POST') {
        event.respondWith((async () => {
            const formData = await request.formData();
            const audioFile = formData.get('audio');
            const text = formData.get('text') || '';
            const title = formData.get('title') || '';
            const sharedUrl = formData.get('url') || '';

            if (audioFile && audioFile.size > 0) {
                // Upload the audio file to the server
                const uploadData = new FormData();
                uploadData.append('audio', audioFile);
                try {
                    const uploadRes = await fetch('/sunoplay/api/upload_song.php', {
                        method: 'POST',
                        body: uploadData
                    });
                    const result = await uploadRes.json();
                    if (result.success && result.song) {
                        return Response.redirect('/sunoplay/?play=' + encodeURIComponent(result.song.id), 303);
                    }
                } catch (e) { /* fall through */ }
                return Response.redirect('/sunoplay/share-receiver.html?error=upload_failed', 303);
            }

            // Text/URL share - redirect to share-receiver with params
            const params = new URLSearchParams();
            if (text) params.set('text', text);
            if (title) params.set('title', title);
            if (sharedUrl) params.set('url', sharedUrl);
            return Response.redirect('/sunoplay/share-receiver.html?' + params.toString(), 303);
        })());
        return;
    }

    // Ignorar esquemas no soportados
    if (url.protocol === 'chrome-extension:' ||
        url.protocol === 'chrome:' ||
        url.protocol === 'extension:' ||
        url.protocol === 'about:') {
        return;
    }

    // No cachear llamadas API, Google ni share-receiver
    if (request.url.includes('/api/') ||
        request.url.includes('share-receiver') ||
        request.url.includes('accounts.google.com') ||
        request.url.includes('googleapis.com')) {
        return;
    }

    // Cachear archivos de audio
    if (request.url.includes('downloads/audio_') || request.url.endsWith('.mp3')) {
        event.respondWith(
            caches.open(AUDIO_CACHE_NAME).then((cache) => {
                return cache.match(request).then((response) => {
                    if (response) return response;
                    return fetch(request).then((fetchResponse) => {
                        if (fetchResponse.status === 200) {
                            cache.put(request, fetchResponse.clone());
                        }
                        return fetchResponse;
                    });
                });
            })
        );
        return;
    }

    // Network-first para assets (siempre intenta la versión nueva)
    event.respondWith(
        fetch(request).then((fetchResponse) => {
            if (fetchResponse.status === 200 && request.method === 'GET') {
                const clone = fetchResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return fetchResponse;
        }).catch(() => {
            return caches.match(request);
        })
    );
});
