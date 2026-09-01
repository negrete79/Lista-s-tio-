/* ============================================================
   SÍTIO RECANTO DA LIMEIRA — Service Worker
   Cache real (arquivo físico), offline garantido.
   Ao publicar uma nova versão, aumente o número da VERSAO.
   ============================================================ */

const VERSAO = 'recanto-limeira-v1.0.0';

/* Arquivos indispensáveis: install falha se algum faltar. */
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json'
];

/* Arquivos opcionais: se ainda não existirem (ex.: ícones ou a
   biblioteca do PDF ainda não enviados), o install NÃO quebra —
   eles entram no cache na primeira navegação com internet. */
const OPCIONAIS = [
  './html2pdf.bundle.min.js',
  './icon-192.png',
  './icon-512.png'
];

/* ---------- INSTALAÇÃO: cria o cache ---------- */
self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ESSENCIAIS);
    await Promise.all(OPCIONAIS.map((url) =>
      cache.add(url).catch(() => null) // opcional: falha silenciosa
    ));
    await self.skipWaiting();
  })());
});

/* ---------- ATIVAÇÃO: limpa caches de versões antigas ---------- */
self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(
      chaves.filter((chave) => chave !== VERSAO)
            .map((chave) => caches.delete(chave))
    );
    await self.clients.claim();
  })());
});

/* ---------- FETCH: cache primeiro, rede depois ----------
   Sem internet → responde pelo cache.
   Com internet → serve e guarda novas respostas no cache
   (fontes do Google, biblioteca do PDF etc. ficam offline). */
self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const doCache = await cache.match(requisicao, { ignoreSearch: true });
    if (doCache) return doCache;

    try {
      const resposta = await fetch(requisicao);
      if (resposta && (resposta.ok || resposta.type === 'opaque')) {
        cache.put(requisicao, resposta.clone());
      }
      return resposta;
    } catch (erro) {
      /* Offline e não estava em cache: fallback para o app. */
      const indice = await cache.match('./index.html');
      if (indice) return indice;
      throw erro;
    }
  })());
});
