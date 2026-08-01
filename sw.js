/* SFC Report System — service worker
   Strategy: NETWORK-FIRST. This keeps the app always up to date
   (matches the single-file / instant-update workflow). It never
   caches Supabase API traffic, so data and auth are always live.
   The cache is only a fallback for the shell if the network is down.
*/
const CACHE = 'sfc-reports-v1';
const SHELL = ['./index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Never touch non-GET or cross-origin API calls (Supabase, CDNs) — always live.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.hostname.endsWith('supabase.co')) return;

  // Network-first for our own shell; fall back to cache only if offline.
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
