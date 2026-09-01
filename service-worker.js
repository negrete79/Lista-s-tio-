/* ============================================================
   Sítio Recanto da Limeira — Service Worker (arquivo real)
   Cache-first para os arquivos do app.
   Runtime cache (stale-while-revalidate) para fontes e para a
   biblioteca de PDF via CDN — garantindo offline total depois
   da primeira visita com internet.
   ============================================================ */
const CACHE = 'recanto-limeira-v1';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './gerar-icones.html'
];

const RUNTIME_HOSTS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net'
];

/* Instalar: gravar no cache o que existir (itens individuais
   não bloqueiam a instalação, caso um ícone ainda não exista) */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async (asset) => {
      try { await cache.add(asset); } catch (e) { /* arquivo opcional ausente */ }
    }));
    await self.skipWaiting();
  })());
});

/* Ativar: limpar caches antigos e assumir o controle */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.indexOf('recanto-limeira-') === 0 && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* Buscar: cache quando offline, rede como atualização */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const sameOrigin = url.origin === self.location.origin;
  const isRuntime  = RUNTIME_HOSTS.some((h) => url.origin === h);
  if (!sameOrigin && !isRuntime) return;

  if (sameOrigin) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    /* Sem rede e sem cache: se for navegação, entrega o app do cache */
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => undefined);
  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  throw new Error('Offline e sem cache: ' + req.url);
}
