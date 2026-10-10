// Offline shell: the app opens with no signal. Data calls to Supabase are never cached here
// (offline data lives in the app's own outbox and caches).
// Network FIRST: a redeploy (or an edited config.js) shows on the very next load.
// If the network fails, or takes more than 3 s (weak signal in the field), the saved copy is used.
const CACHE = 'oilrep-flat-279607613f';
const SHELL = ['./', 'boot_remote.js', 'config.js', 'device.js', 'gps_real.js', 'handover.js', 'html5-qrcode.min.js', 'i18n.js', 'icon-192.png', 'icon-512.png', 'index.html', 'main.js', 'manifest.webmanifest', 'net_remote.js', 'qrcode.min.js', 'remote_ui.js', 'style.css', 'ui_admin.js', 'ui_core.js', 'ui_rep.js', 'util.js', 'views.js'];
const NET_TIMEOUT_MS = 3000;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const sameOrigin = u.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!sameOrigin && !font) return;                          // Supabase and everything else: straight to network
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const saved = await c.match(e.request, { ignoreSearch:true }) || (e.request.mode === 'navigate' ? await c.match('index.html') : null);
    if (font) {                                              // fonts rarely change: serve saved, refresh quietly
      const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => saved);
      return saved || net;
    }
    const ctl = new AbortController(), timer = saved ? setTimeout(() => ctl.abort(), NET_TIMEOUT_MS) : null;   // no saved copy: wait as long as it takes
    try {
      const r = await fetch(e.request, { cache:'no-store', signal:ctl.signal });
      if (timer) clearTimeout(timer);
      if (r && r.ok) c.put(e.request, r.clone());
      return r;
    } catch(err) {
      if (timer) clearTimeout(timer);
      return saved || Response.error();
    }
  })());
});
