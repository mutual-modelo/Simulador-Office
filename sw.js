// Service Worker mínimo para habilitar instalación PWA y acceso directo en Chrome/Edge/Android
// Mantiene estrategia network-first pura sin retener respuestas obsoletas de API o sesión.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';
  if (!url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
