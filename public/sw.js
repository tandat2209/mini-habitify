/* Only the generic offline screen is cached. Private pages, API calls, and
   auth callbacks always use the network and are never written to Cache Storage. */
const CACHE_NAME = "mini-habitify-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("mini-habitify-offline-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/oauth/")
  )
    return;
  event.respondWith(
    fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL, {
        cacheName: CACHE_NAME,
      });
      return offline || Response.error();
    }),
  );
});
