// Service Worker for Tarama Grid Game
const CACHE_NAME = 'tarama-grid-game-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Özellikle socket.io isteklerini ve harici API çağrılarını yönet
        const url = new URL(event.request.url);
        
        // Socket.io veya harici API isteklerini ServiceWorker'dan bypass et
        if (url.pathname.includes('socket.io') || 
            url.hostname !== self.location.hostname) {
          return fetch(event.request).catch(err => {
            console.log('Fetch error:', err);
            // Hata durumunda boş bir yanıt döndür
            return new Response('', {
              status: 408,
              statusText: 'Service Unavailable'
            });
          });
        }
        
        // Diğer istekler için normal fetch işlemi
        return fetch(event.request).catch(err => {
          console.log('Fetch error:', err);
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});