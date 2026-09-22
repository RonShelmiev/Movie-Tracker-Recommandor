/**
 * Flick's service worker.
 *
 * It exists for one reason: an app added to the home screen was showing an
 * old build until it was removed and re-added. Left to the browser cache, an
 * installed web app can sit on a stale copy of the page for a long time, and
 * since this app IS one HTML file, a stale page means a stale app.
 *
 * So: network first, always. Every launch asks the server what the current
 * build is, and the cache is only a fallback — for being offline, or for a
 * network too slow to wait on. That ordering is the whole point; a
 * cache-first worker would reintroduce exactly the problem it is here to fix.
 *
 * The version below is stamped in at build time, which means this file's
 * bytes differ on every deploy. That is deliberate: the browser decides
 * whether a worker is "new" by comparing bytes at the same URL, so putting
 * the version in the URL instead would leave an already-open app re-fetching
 * its own version forever and never noticing a newer one.
 */

const VERSION = '__FLICK_BUILD__';
const CACHE = `flick-${VERSION}`;
const SHELL = new URL('./', self.location.href).href;

/** How long to wait for the network before falling back to a cached copy. */
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', () => {
  // Take over as soon as this build is installed rather than waiting for
  // every tab to close — an installed app rarely "closes".
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** An explicit "drop everything" from the app's reset button. */
self.addEventListener('message', (event) => {
  if (event.data === 'flick:reset') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
      })(),
    );
  }
});

async function fromNetwork(request) {
  // `no-store` so the HTTP cache cannot answer on the server's behalf — that
  // layer is the one that was serving the old build.
  const response = await fetch(request, { cache: 'no-store' });
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // TMDB, Google Fonts and Supabase are somebody else's business.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      // With something cached, race the network rather than block on it: a
      // slow connection should not mean a slow launch. The fetch keeps going
      // either way, so the next launch has the newer copy.
      if (cached) {
        try {
          return await Promise.race([
            fromNetwork(request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NETWORK_TIMEOUT)),
          ]);
        } catch {
          return cached;
        }
      }

      try {
        return await fromNetwork(request);
      } catch (err) {
        // A navigation to a URL shape we have not cached — a query string or
        // a hash route — can still be served by the page itself.
        if (request.mode === 'navigate') {
          const shell = await caches.match(SHELL);
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
