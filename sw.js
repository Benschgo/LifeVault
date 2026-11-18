// LifeVault Service Worker: Netzwerk zuerst (Updates kommen sofort an), Cache als Offline-Fallback
const CACHE = 'schulvault-v12';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png?v=tresor', './kalender-bild.webp'];
const PUSH_SEEN = 'sv-push-seen';   // gezeigte Erinnerungs-Schlüssel (teilt sich mit der App), damit nichts doppelt piept

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PUSH_SEEN).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // GitHub-API etc. nie anfassen
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'notif-nav', url });
          c.focus();
          if ('navigate' in c) { try { c.navigate(url); } catch (_) {} }
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* Push vom Erinnerungs-Dienst im Daten-Repo (dienst/erinnerungen.mjs) – kommt auch bei geschlossener App */
const seenReq = key => new Request('./__seen/' + encodeURIComponent(key));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'LifeVault', url = d.url || './', tag = d.tag || url + ':' + title;
  e.waitUntil((async () => {
    let seen = false;
    try {
      const c = await caches.open(PUSH_SEEN);
      if (d.key) { seen = !!(await c.match(seenReq(d.key))); if (!seen) await c.put(seenReq(d.key), new Response(String(Date.now()))); }
    } catch (_) { /* ohne Cache einfach anzeigen */ }
    if (seen && (await self.registration.getNotifications({ tag })).length) return;   // steht schon da
    await self.registration.showNotification(title, {
      body: d.body || '', icon: 'icon-192.png?v=tresor', badge: 'icon-192.png?v=tresor', tag, data: { url }, silent: seen
    });
  })());
});
/* Abo vom Browser erneuert → gleich neu anmelden; die App trägt die neue Adresse beim nächsten Start ins Daten-Repo ein */
self.addEventListener('pushsubscriptionchange', e => {
  const opts = e.oldSubscription && e.oldSubscription.options;
  if (opts && opts.applicationServerKey) e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: opts.applicationServerKey }).catch(() => {}));
});
