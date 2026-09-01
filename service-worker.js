const CACHE_NAME='recanto-limeira-v1';
const ASSETS=['./','./index.html','./manifest.json','./service-worker.js','./html2pdf.bundle.min.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate', e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch', e=>{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>e.request.destination==='document'?caches.match('./index.html'):null)))});
