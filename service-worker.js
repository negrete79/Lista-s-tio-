const CACHE_NAME = "recanto-limeira-v1";

const APP_FILES = [
"./",
"./index.html",
"./manifest.json",
"./icon-192.png",
"./icon-512.png"
];

/* Instalação */

self.addEventListener("install", event => {

event.waitUntil(

```
caches.open(CACHE_NAME)
  .then(cache => {

    return cache.addAll(APP_FILES);

  })
  .then(() => {

    return self.skipWaiting();

  })
```

);

});

/* Ativação */

self.addEventListener("activate", event => {

event.waitUntil(

```
caches.keys()
  .then(keys => {

    return Promise.all(

      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))

    );

  })
  .then(() => {

    return self.clients.claim();

  })
```

);

});

/* Requisições */

self.addEventListener("fetch", event => {

if(event.request.method !== "GET"){
return;
}

event.respondWith(

```
caches.match(event.request)
  .then(cached => {

    if(cached){
      return cached;
    }

    return fetch(event.request)
      .then(response => {

        /*
         * Recursos externos como Tailwind e html2pdf
         * também podem ser armazenados depois que forem
         * carregados pela primeira vez.
         */

        if(
          response &&
          (
            response.ok ||
            response.type === "opaque"
          )
        ){

          const copy=response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                copy
              );

            })
            .catch(()=>{});

        }

        return response;

      })
      .catch(() => {

        if(
          event.request.mode === "navigate"
        ){

          return caches.match(
            "./index.html"
          );

        }

        return new Response(
          "",
          {
            status:503,
            statusText:"Offline"
          }
        );

      });

  })
```

);

});
