/**
 * Service worker of the published site: it lets the site start with the network switched off
 * once it has been loaded once.
 *
 * Vite copies this file to dist/ as it is. At the end of a build, the plugin of vite.config.ts
 * replaces the two placeholders below with the cache name (a fixed prefix and a hash of the
 * paths and of the contents of every file of the site) and with the list of those files, each
 * as a path relative to the folder of this worker with the sha256 of its bytes. Any change of
 * the site therefore changes the bytes of this file, which is how a browser knows that a new
 * version exists.
 *
 * - Install takes everything or nothing, and stores only what it has checked: every file of the
 *   list is fetched past the HTTP cache of the browser, must answer with a success status and
 *   must have the sha256 of the build before it is put in the cache of this build. If one file
 *   fails, the cache being filled is deleted and the install fails, so that the previous worker
 *   stays in charge and a later visit tries again.
 * - A new worker waits. It never calls skipWaiting and the page never reloads itself, so an open
 *   page keeps the worker and the cache it was loaded with and never receives the scripts of
 *   another publication, and an evening in progress is not reloaded under the people who use
 *   it. The new version takes over once every tab of the site has been closed. For a person:
 *   after a publication, the site must be closed and opened again once to show the new version.
 * - The scope is the folder of this file, so the address of the site without its final slash is
 *   outside it and does not start offline; open and bookmark the address with its final slash.
 *   No code can change this, since GitHub Pages cannot send the header that widens a scope.
 * - Activate removes the caches of other builds, and only those whose name starts with the
 *   prefix of this site.
 * - Fetch answers a GET request of this origin and inside the scope from the cache of this
 *   build, ignoring the search part of the address (the pages take developer parameters), and
 *   answers a request for a folder with its index.html. Anything else, and any failure of the
 *   cache storage, goes to the network.
 */

const CACHE_PREFIX = 'webdyad-';
const CACHE_NAME = "webdyad-cf82d9d35b3bde95";
const CACHE_FILES = [{"path":"assets/control-CykJOnr4.js","sha256":"10af66374d6ac959b566ad6631706abf6d620060ff9b6a5153a4a7777836182d"},{"path":"assets/diagnostic-xWdyq5zS.js","sha256":"fdc934cc0f3b6c9d719f21060517f734af6c4da306aa4415ef92abb828fb0798"},{"path":"assets/dyad-session--C4VgQHw.js","sha256":"716f68ebff79843d72ac99d774008862b6597f1ba6b920a4465e14cdcfe431a0"},{"path":"assets/main-CEogqJrQ.js","sha256":"b5f64eed2b078d07066ea1bc5fa1a3cd806dbde09ba5ecb4e9a734e74522920a"},{"path":"assets/main-ORRiIa0P.css","sha256":"c99f13a0bdc1a8f66bebf867b7ff1f7db35dd4243a1c8a155d6f57ac8412ea24"},{"path":"assets/nunito-cyrillic-ext-wght-normal-D4X5GqEv.woff2","sha256":"88985ca614d50fbe06bf527b0d67703d01cab729d744e41c1b5b6bf67c3a08e5"},{"path":"assets/nunito-cyrillic-wght-normal-CY6AOgYE.woff2","sha256":"63b14e3ef0966785438b8947380dfbcad178cbd3c6a5ed2172672ca0d8b839ac"},{"path":"assets/nunito-latin-ext-wght-normal-CXYtwYOx.woff2","sha256":"2c8d792869818ecb253a46bc3c63c7013df7aac2f69291c3c85e5cdc94160960"},{"path":"assets/nunito-latin-wght-normal-BzFMHfZw.woff2","sha256":"ba344451eab25b217a165363b1982048a5e5830a0daf36577973955a04cac793"},{"path":"assets/nunito-vietnamese-wght-normal-U01xdrZh.woff2","sha256":"61e5958cf3c731423456b31739aa454317ea3bdcb205dd87090e94f632c3642b"},{"path":"assets/pipeline-BJEHQZFC.js","sha256":"2e33ea03801e596401a46cd15ca184cf8a6e65e660e1190d5ac9f6b3346bfec8"},{"path":"assets/preload-helper-nQ8mCpAK.js","sha256":"d2f1d2c042be949d38392bcd1bc6bf5b63acd33aee6daabe6f4ee33c3505c53c"},{"path":"assets/recording-file-osyD-ERU.js","sha256":"047d40467ca001201c5137502cfd28877793ce251548dfae4aac4429954a6271"},{"path":"assets/sound-layer-B3uodPse.js","sha256":"2e9aab2c63bf60f4ff37899c9a0ecf99cf83cbb400a6ea9ef0422260271a3f83"},{"path":"assets/stage-D5GCdmDz.js","sha256":"bd1594686940f5f06cd2a18493b6fdd1c9997906ad24dd7805826e2f65981c0a"},{"path":"control.html","sha256":"09abb5b352680621edb3ed2b41abc2d7841a491e0f4e5093be9ed678b7af82b7"},{"path":"diagnostic.html","sha256":"ed2084ece1b24290ab56215fdeefbebb80a91b824f2c028c6027cace2f87a83c"},{"path":"index.html","sha256":"c32c713ff000171eec2174dcb3ebddea000c45de6a656bc7629362ed118b00b5"},{"path":"manifest.webmanifest","sha256":"5d51971862e8c4784eebb66aaec81dc6125510937a35556d3478feb2e2772c00"},{"path":"stage.html","sha256":"207f4f57d10d6680816af631d32554150d19ac206795d8048be5c9f1773d62bc"}];

const scope = self.registration.scope;

/** Lower-case hexadecimal sha256 of the bytes. */
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fillCache() {
  const cache = await caches.open(CACHE_NAME);
  try {
    await Promise.all(
      CACHE_FILES.map(async ({ path, sha256 }) => {
        // `reload` skips the HTTP cache, which could hold a file of the previous publication.
        const request = new Request(new URL(path, scope).href, { cache: 'reload' });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`${path}: the server answered ${response.status}`);
        const actual = await sha256Hex(await response.clone().arrayBuffer());
        if (actual !== sha256) {
          throw new Error(`${path}: the bytes received are not those of the build`);
        }
        await cache.put(request, response);
      }),
    );
  } catch (error) {
    // Nothing half-filled is left behind.
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(fillCache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(scope)) return;
  // The search part and the fragment are left out of the key; a folder means its index.html.
  const key = url.origin + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
  event.respondWith(
    // `caches.match` with a cache name opens nothing, so an evicted cache is not recreated empty.
    caches
      .match(key, { cacheName: CACHE_NAME })
      .catch(() => undefined)
      .then((cached) => cached ?? fetch(request)),
  );
});
