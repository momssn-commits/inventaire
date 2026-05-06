// Service Worker — Inventaire PWA
// Stratégie : network-first pour TOUT (toujours servir le dernier code).
// Si une réponse Next.js (chunk JS, HTML) renvoie 404 ou échoue alors qu'on
// avait une version cachée, on ne sert pas la version cachée pour éviter
// les bundles fantômes obsolètes — on désinscrit le SW et recharge.

const CACHE_NAME = 'inventaire-v4';
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

  const url = new URL(request.url);

  // Ne pas intercepter les chunks Next.js — laisser le navigateur traiter directement.
  // Si on a un chunk obsolète en cache et que le serveur le renvoie en 404, on
  // produit une "ChunkLoadError" qui sera attrapée par error.tsx.
  if (url.pathname.startsWith('/_next/static/')) return;

  // Pour le reste : network-first sans fallback cache (sauf app shell minimal).
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/login')))
  );
});

// Permet à la page de demander au SW de se désinscrire (utilisé par error.tsx).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'UNREGISTER') {
    self.registration.unregister();
  }
});
