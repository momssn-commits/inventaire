// Service Worker minimal pour Inventaire PWA
// Met en cache l'app shell et permet le fonctionnement hors-ligne basique

const CACHE_NAME = 'inventaire-v2';
const APP_SHELL = ['/login', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Stratégie : network-first avec fallback cache (SPA-friendly)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Mettre en cache uniquement les assets statiques
        if (response.ok && request.url.includes('/_next/static/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/login')))
  );
});
