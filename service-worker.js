/* ============================================================
   SÍTIO RECANTO DA LIMEIRA — Service Worker (arquivo real)
   Instala, ativa, cria o cache, limpa caches antigos e
   responde pelo cache quando não há internet.
   ============================================================ */

const CACHE_NAME = 'recanto-limeira-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './html2pdf.bundle.min.js'
];

/* ---------- INSTALAR: cria o cache e armazena os arquivos ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cacheia item a item: se algum arquivo opcional estiver ausente,
    // o restante continua sendo armazenado normalmente.
    await Promise.allSettled(
      CORE_ASSETS.map(async (url) => {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (e) {
          // Arquivo ainda não publicado (ex.: html2pdf.bundle.min.js será adicionado depois).
        }
      })
    );
    await self.skipWaiting();
  })());
});

/* ---------- ATIVAR: limpa caches antigos e assume o controle ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(
      nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------- FETCH: offline de verdade ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  /* Navegação (abertura do app): rede primeiro; sem internet, responde pelo cache. */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) ||
               new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  /* Demais recursos: cache primeiro; em segundo plano, atualiza silenciosamente. */
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) {
      event.waitUntil(revalidar(req));
      return cached;
    }
    const fresh = await revalidar(req);
    return fresh || new Response('', { status: 504, statusText: 'Offline' });
  })());
});

/* Busca na rede e guarda no cache quando a resposta é válida. */
async function revalidar(req) {
  try {
    const fresh = await fetch(req);
    const origemOk = new URL(req.url).origin === self.location.origin;
    if (fresh && (fresh.status === 200 || fresh.type === 'opaque') && origemOk) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    return null;
  }
}
