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
  event.waitUntil(self.registration.showNotification(title, options));
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
