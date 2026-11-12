/* Service worker Accent — écrit à la main, aucune dépendance (pas de Workbox).
 *
 * Objectif (RNF-08) : l'app reste disponible pendant le jugement, même hors
 * réseau ou si un hébergeur tousse. Les phrases d'entraînement et la taxonomie
 * sont déjà dans le bundle ; il ne manque que les assets.
 *
 * Trois règles non négociables :
 *  1. JAMAIS d'audio en cache (RNF-P1). Ni blob:, ni data:, ni réponse dont le
 *     type est audio/*. La voix ne doit être persistée nulle part, pas même ici.
 *  2. JAMAIS d'interception de /api/ : le proxy doit rester joignable, et son
 *     404 (hébergement statique) est précisément ce qui déclenche le repli local
 *     côté client. Mettre une réponse d'API en cache ferait mentir le produit.
 *  3. Un service worker qui casse le réseau est pire que pas de service worker :
 *     tous les handlers sont en try/catch et les échecs retombent sur le réseau.
 */

const VERSION = 'accent-v1';
const CACHE_SHELL = VERSION + '-shell';
const CACHE_ASSETS = VERSION + '-assets';

const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_SHELL);
        // addAll échoue au premier 404 : on ajoute un par un pour rester robuste.
        await Promise.all(
          SHELL.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        );
      } catch (e) {
        console.warn('[sw] précache partiel :', e);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cles = await caches.keys();
      await Promise.all(
        cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Une requête ne doit jamais être mise en cache si elle porte de l'audio. */
function interditDeCache(request, response) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
  const type = (response.headers && response.headers.get('content-type')) || '';
  return type.startsWith('audio/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Règle 2 : on ne touche jamais au proxy.
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord (pour ne pas servir une version périmée après un
  // redéploiement), repli sur le cache si hors ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const reseau = await fetch(request);
          if (reseau && reseau.ok) {
            const cache = await caches.open(CACHE_SHELL);
            cache.put('./index.html', reseau.clone()).catch(() => undefined);
          }
          return reseau;
        } catch (e) {
          const cache = await caches.open(CACHE_SHELL);
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets hashés par Vite (assets/*) : immuables, donc cache d'abord.
  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_ASSETS);
        const deja = await cache.match(request);
        if (deja) return deja;
        const reseau = await fetch(request);
        if (reseau && reseau.ok && !interditDeCache(request, reseau)) {
          cache.put(request, reseau.clone()).catch(() => undefined);
        }
        return reseau;
      } catch (e) {
        const cache = await caches.open(CACHE_ASSETS);
        return (await cache.match(request)) || Response.error();
      }
    })(),
  );
});
