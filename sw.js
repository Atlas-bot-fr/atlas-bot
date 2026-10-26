/* Atlas Bot : service worker.
 * Règle d'or : on ne touche QU'AU site lui-même (même origine). L'API du bot, les Gists, GitHub, top.gg et Discord ne passent jamais par ici :
 * aucune donnée de serveur, aucun jeton, aucun statut n'est mis en cache.
 * Stratégie « réseau d'abord » : le site à jour s'affiche toujours quand il y a du réseau ; la copie sert seulement hors ligne. */
const VERSION = '1793051919';
const CACHE = 'atlas-' + VERSION;
const SHELL = ["./", "manifest.webmanifest", "assets/favicon.svg", "css/style.css?v=1793051919", "js/app.js?v=1793051919", "js/atlasshop.js?v=1793051919", "js/cardspage.js?v=1793051919", "js/catpages.js?v=1793051919", "js/commtools.js?v=1793051919", "js/config.js", "js/embededitor.js?v=1793051919", "js/fx.js?v=1793051919", "js/guidepage.js?v=1793051919", "js/home.js?v=1793051919", "js/i18n.js?v=1793051919", "js/lbpage.js?v=1793051919", "js/modtool.js?v=1793051919", "js/partnerspage.js?v=1793051919", "js/pwa.js?v=1793051919", "js/rolestool.js?v=1793051919", "js/settings.js?v=1793051919", "js/sidebar.js?v=1793051919", "js/staffpanel.js?v=1793051919", "js/staffplus.js?v=1793051919", "js/themes.js?v=1793051919", "js/tools.js?v=1793051919", "js/trophiespage.js?v=1793051919"];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('atlas-') && key !== CACHE) await caches.delete(key); // anciennes versions
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API, Gist, GitHub, top.gg… : jamais interceptés
  if (url.pathname.endsWith('/sw.js')) return; // le navigateur doit toujours pouvoir voir une nouvelle version
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return res;
  } catch {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') { const index = await caches.match('./'); if (index) return index; }
    return Response.error();
  }
}

/* Notifications push (alerte raid, nouveau ticket, réseau de vigilance). Le serveur n'envoie que du texte court, sans pseudo ni message. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }
  const clean = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const url = typeof d.url === 'string' && /^#[a-z0-9/_-]{0,40}$/i.test(d.url) ? d.url : '#';
  event.waitUntil(self.registration.showNotification(clean(d.title, 80) || 'Atlas Bot', {
    body: clean(d.body, 200), tag: clean(d.tag, 60) || undefined, renotify: Boolean(d.tag),
    icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./' + (event.notification.data?.url || '#'), self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); if ('navigate' in c) try { await c.navigate(target); } catch {} return; }
    }
    await self.clients.openWindow(target);
  })());
});
