// RYCOS Shift Service Worker - Safari & Mobile Compatible (v1.3)
const CACHE_NAME = "rycos-shift-v1.3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy: always fetch fresh resources, fallback to cache only if offline
self.addEventListener("fetch", (event) => {
  // Nie przechwytuj zapytań API ani schematów innych niż http/https
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    !event.request.url.startsWith("http")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
        });
      })
  );
});
