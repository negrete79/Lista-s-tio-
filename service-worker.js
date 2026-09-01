/* ============================================================
   SÍTIO RECANTO DA LIMEIRA — Service Worker
   Cache do app shell + runtime para fontes e biblioteca do PDF.
   Para publicar uma atualização, troque VERSAO (ex.: v1 → v1-2).
   ============================================================ */
'use strict';

const VERSAO = 'recanto-limeira-v1';
const ESSENCIAIS = ['./', './index.html', './manifest.json'];
const OPCIONAIS  = ['./html2pdf.bundle.min.js', './icon-192.png', './icon-512.png'];

/* ---------- Instalação: cria o cache e armazena os arquivos ---------- */
self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    try { await cache.addAll(ESSENCIAIS); } catch (e) { /* nunca bloquear a instalação */ }
    await Promise.all(OPCIONAIS.map(async (url) => {
      try { await cache.add(url); } catch (e) { /* opcional: pode faltar sem quebrar */ }
    }));
    await self.skipWaiting();
  })());
});

/* ---------- Ativação: limpa caches antigos ---------- */
self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ---------- Fetch: cache-first (rural = internet instável) ---------- */
self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Terceiros (fontes do Google, CDN da biblioteca): cache-first com guarda em runtime */
  if (url.origin !== self.location.origin) {
    const ehRecurso = req.destination === 'font' || req.destination === 'style' ||
                      url.hostname.includes('fonts') || url.hostname.includes('cdn') || url.hostname.includes('cdnjs');
    if (!ehRecurso) return;
    evento.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      const emCache = await cache.match(req);
      if (emCache) return emCache;
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        return Response.error();
      }
    })());
    return;
  }

  /* Navegação: sempre resolvida pelo index.html em cache */
  if (req.mode === 'navigate') {
    evento.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      const emCache = (await cache.match('./index.html')) || (await cache.match('./'));
      if (emCache) return emCache;
      try {
        const resp = await fetch(req);
        cache.put('./index.html', resp.clone());
        return resp;
      } catch (e) {
        return Response.error();
      }
    })());
    return;
  }

  /* Demais recursos same-origin: cache-first */
  evento.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const emCache = await cache.match(req);
    if (emCache) return emCache;
    try {
      const resp = await fetch(req);
      if (resp && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    } catch (e) {
      return Response.error();
    }
  })());
});
