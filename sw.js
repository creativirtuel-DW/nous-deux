/**
 * Nous Deux — service worker
 * Sert uniquement à recevoir les notifications push : aucune mise en cache,
 * l'app est toujours chargée depuis le réseau (elle est minuscule).
 */

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = {};
  try{ d = event.data ? event.data.json() : {}; }catch(err){ d = { body: event.data && event.data.text() }; }

  const title = d.title || 'Nous Deux';
  const options = {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'nous-deux',       // une notif du même type remplace la précédente
    renotify: true,
    data: { url: d.url || './index.html' }
  };
  // Pastille chiffrée sur l'icône de l'appli (iPhone 16.4+, appli installée).
  const pastille = (typeof d.badge === 'number' && self.navigator && 'setAppBadge' in self.navigator)
    ? (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {})
    : Promise.resolve();
  // Notification venue du serveur (rappel « Une pensée par jour ») : l'appli ne
  // la connaît pas, on la garde ici pour l'historique du dev mod (suivi.js la
  // relit et la range à la prochaine ouverture).
  const journal = d.src === 'app' ? Promise.resolve() : caches.open('nd-notifs-recues').then(c =>
    c.put(new Request('./__notif/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
          new Response(JSON.stringify({ ts: Date.now(), t: title, tag: d.tag || '' })))).catch(() => {});
  event.waitUntil(Promise.all([self.registration.showNotification(title, options), pastille, journal]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si l'app est déjà ouverte quelque part, on la ramène au premier plan.
      for(const client of list){
        if('focus' in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
