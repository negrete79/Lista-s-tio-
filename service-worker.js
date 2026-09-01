/* Sítio Recanto da Limeira - Service Worker Offline */
const CACHE_NAME = 'recanto-limeira-v1';
const URL_CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './html2pdf.bundle.min.js',
  './icon-192.png',
  './icon-512.png'
];

// Instalação: guarda o essencial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE.map(url => new Request(url, {cache: 'reload'})))
        .catch(() => cache.add('./index.html')); // ignora erro se os ícones ainda não existem
    })
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

// Estratégia de fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. html2pdf: tenta local, se falhar busca do CDN e guarda em cache
  if (url.pathname.endsWith('html2pdf.bundle.min.js')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).catch(() => fetch(URL_CDN_PDF)).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2. Google Fonts: Stale-While-Revalidate
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cached) => {
          const fetched = fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetched;
        });
      })
    );
    return;
  }

  // 3. Todo o resto do mesmo domínio: Cache First com fallback para index.html (offline)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => {
          if (req.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
