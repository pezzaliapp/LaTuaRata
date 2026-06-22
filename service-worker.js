/* service-worker.js — LaTuaRata */
/* CACHE_NAME univoco: cambiarlo a ogni rilascio forza l'aggiornamento. */
const CACHE_NAME = "latuarata_v2026_06_22";

/* Solo file realmente presenti su disco: cache.addAll è atomico,
   un singolo 404 romperebbe l'installazione offline.
   (Nessun riferimento a libs/jspdf.umd.min.js, che non esiste.) */
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icons_crm-192x192.png",
  "./icons/icons_crm-512x512.png",
  "./data/Domanda_NOLEGGIO.pdf",
  "./data/Modulo_firma_digitale.pdf",
  "./data/Privacy_-_Attestazione_avvenuta_consegna.pdf",
  "./data/Scheda_prodotto_NOLEGGIO.pdf"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldKeys = keys.filter((k) => k !== CACHE_NAME);
      const hasOldCache = oldKeys.length > 0;

      await Promise.all(oldKeys.map((k) => caches.delete(k)));
      await self.clients.claim();

      if (hasOldCache) {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        allClients.forEach((client) => {
          client.postMessage({ type: "APP_UPDATED" });
        });
      }
    })
  );
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetch(req);
}

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(req);
    return cached || caches.match("./index.html");
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req).then(async (fresh) => {
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || fetchPromise || caches.match("./index.html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
