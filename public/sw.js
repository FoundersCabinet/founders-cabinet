// Founder's Cabinet service worker — v1
// Network-first for everything; falls back to cached shell when offline.
const CACHE = "fc-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls — AI responses must always be fresh
  if (url.pathname.startsWith("/api/")) return;

  // Network-first, cache fallback (so updates always win when online)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (e.request.method === "GET" && res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/index.html")))
  );
});
