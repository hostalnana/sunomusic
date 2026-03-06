const CACHE_NAME = 'sunoplay-cache-v36';

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

    // Ignorar esquemas no soportados
    if (url.protocol === 'chrome-extension:' ||
        url.protocol === 'chrome:' ||
        url.protocol === 'extension:' ||
        url.protocol === 'about:') {
        return;
    }

    // No cachear llamadas API ni Google
    if (request.url.includes('/api/') ||
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
