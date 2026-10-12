/*
 * CareNow service worker.
 *
 * Deliberately conservative, because this app renders health data:
 *  - Static build output (/_next/static, fonts, icons) is cache-first — it is
 *    content-addressed and immutable, so this is safe and makes the app open
 *    instantly on a phone.
 *  - Navigations are network-first with a cached shell fallback, so a patient
 *    offline sees an explanation rather than a browser error page.
 *  - Anything that could carry personal data (API routes, Supabase, video) is
 *    never cached. Health responses must not sit in a shared HTTP cache.
 */

const VERSION = "carenow-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE = ["/offline", "/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest"];

/** Paths that must never be written to a cache. */
const NEVER_CACHE = [/^\/api\//, /supabase\.co/, /daily\.co/, /stripe\.com/, /paystack\.co/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return;

  // Immutable build output: cache-first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first, cached page as the fallback, offline page last.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return (
            offline ??
            new Response("<h1>You're offline</h1><p>CareNow needs a connection to load this screen.</p>", {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }),
    );
  }
});
