importScripts('./precache.js');
const {urls, version} = self.ORDAYA_PRECACHE;
const cacheName = 'ordaya-standard-shell-' + version;
const assets = new Set(urls);
const entry = urls.find(url => url.endsWith('/workspace-bundle.js'));


function isPilot(url) {
  return url.origin === self.location.origin && url.pathname === '/ordaya' &&
    url.searchParams.size === 2 && url.searchParams.get('app') === '1' &&
    url.searchParams.get('pilot') === '1';
}

function isPlainApp(url) {
  return url.origin === self.location.origin && url.pathname === '/ordaya' &&
    url.searchParams.size === 1 && url.searchParams.get('app') === '1';
}
// Only a successfully opened Standard workspace opts this browser into the
// plain-URL offline shell. The shell still verifies the saved email session.
const optIn = new URL('/ordaya-worker/standard-enabled', self.location.origin).href;
self.addEventListener('message', event => {
  if (!event.source?.url || !isPlainApp(new URL(event.source.url))) return;
  if (event.data?.type === 'ordaya-standard-offline-enabled') {
    event.waitUntil(caches.open(cacheName).then(cache => cache.put(optIn, new Response('1'))));
  }
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // addAll commits atomically. A missing dependency leaves the previous worker active.
    await cache.addAll(urls.map(url => new Request(url, {credentials: 'omit', cache: 'reload', redirect: 'error'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('Authorization')) return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && (isPilot(url)||isPlainApp(url))) {
    event.respondWith(fetch(req).catch(async error => {
      if (!isPilot(url) && !(await (await caches.open(cacheName)).match(optIn))) throw error;
      return new Response(
      '<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ordaya | Offline workspace</title><main id="app"><h1>Ordaya</h1><p>Opening your offline workspace…</p></main><dialog id="dialog"></dialog><div id="toast" role="status"></div><script type="module" src="' + entry + '"></script></html>',
      {headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
    );}));
    return;
  }
  const key = url.origin + url.pathname;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const client = event.clientId && await self.clients.get(event.clientId);
    if (!client) return fetch(req);
    const location = new URL(client.url);
    if (!isPilot(location) && !(isPlainApp(location) && await (await caches.open(cacheName)).match(optIn))) return fetch(req);
    try { return await fetch(req); }
    catch (error) {
      const saved = await (await caches.open(cacheName)).match(key);
      if (saved) return saved;
      throw error;
    }
  })());
});
