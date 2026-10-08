// Offline shell: the app opens with no signal. Data calls to Supabase are never cached here
// (offline data lives in the app's own outbox and caches).
const CACHE = 'oilrep-shell-v2';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/.netlify/') || u.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  const sameOrigin = u.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!sameOrigin && !font) return;                         // Supabase and everything else: straight to network
  e.respondWith(caches.open(CACHE).then(async c => {       // stale-while-revalidate
    const hit = await c.match(e.request, { ignoreSearch:true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
