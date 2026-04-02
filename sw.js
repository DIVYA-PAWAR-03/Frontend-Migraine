// MigraineCare AI - Service Worker
const CACHE_NAME = 'migrainecare-v1';
const STATIC_CACHE = 'migrainecare-static-v1';
const DYNAMIC_CACHE = 'migrainecare-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/professional_index.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Static assets cached');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[ServiceWorker] Cache failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => {
                            console.log('[ServiceWorker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip API calls - always fetch from network
    if (url.pathname.startsWith('/api/') || url.origin !== location.origin) {
        if (url.origin === location.origin) {
            return;
        }
        // For external resources (fonts, icons), try cache first
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request)
                        .then((response) => {
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(DYNAMIC_CACHE)
                                    .then((cache) => cache.put(request, responseClone));
                            }
                            return response;
                        });
                })
        );
        return;
    }

    // For same-origin requests, use cache-first strategy
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version and update in background
                    fetch(request)
                        .then((response) => {
                            if (response.status === 200) {
                                caches.open(STATIC_CACHE)
                                    .then((cache) => cache.put(request, response));
                            }
                        })
                        .catch(() => {});
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(request)
                    .then((response) => {
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then((cache) => cache.put(request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for HTML pages
                        if (request.headers.get('accept').includes('text/html')) {
                            return caches.match('/professional_index.html');
                        }
                    });
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Background sync:', event.tag);
    if (event.tag === 'sync-health-data') {
        event.waitUntil(syncHealthData());
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received');
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/professional_index.html'
        },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'close', title: 'Close' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'MigraineCare AI', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification clicked');
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('professional_index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || '/professional_index.html');
                }
            })
    );
});

// Sync health data when back online
async function syncHealthData() {
    try {
        const cache = await caches.open('offline-data');
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            const data = await response.json();
            
            await fetch(request.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            await cache.delete(request);
        }
        console.log('[ServiceWorker] Health data synced');
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
    }
}
