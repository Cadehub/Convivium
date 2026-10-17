/* Convivium Home Hotel — Firebase Cloud Messaging service worker.
 *
 * Scope: push notifications ONLY. This worker does not intercept `fetch`, does not
 * cache anything and does not touch the app shell, so it cannot affect loading,
 * offline behaviour or deployments of the site.
 *
 * Public Firebase web config is passed by the page through the registration URL
 * query string (it is public by design). No secret ever reaches this file.
 */

const FIREBASE_SDK_VERSION = '13.0.0';
const ALLOWED_TARGETS = ['kitchen', 'admin', 'track'];
const REFERENCE_RE = /^[A-Za-z0-9-]{4,32}$/;

// Registered BEFORE the Firebase SDK so it is always the click handler in use.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = ALLOWED_TARGETS.includes(data.target) ? data.target : 'track';
  const ref = REFERENCE_RE.test(data.ref || '') ? data.ref : '';

  // Only a target + public reference travel in the URL. The page re-checks the
  // session / order access token before showing anything private.
  const params = new URLSearchParams({ n: target });
  if (target === 'track' && ref) params.set('ref', ref);
  const url = '/?' + params.toString();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: 'CONVIVIUM_NOTIFICATION_CLICK', target, ref });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const query = new URLSearchParams(self.location.search);
const config = {
  apiKey: query.get('apiKey'),
  authDomain: query.get('authDomain') || undefined,
  projectId: query.get('projectId'),
  messagingSenderId: query.get('messagingSenderId'),
  appId: query.get('appId'),
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  importScripts(
    'https://www.gstatic.com/firebasejs/' + FIREBASE_SDK_VERSION + '/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/' + FIREBASE_SDK_VERSION + '/firebase-messaging-compat.js'
  );

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Messages are data-only: title/body are already localised by the server per device.
  messaging.onBackgroundMessage((payload) => {
    const data = (payload && payload.data) || {};
    if (!data.title) return;
    return self.registration.showNotification(data.title, {
      body: data.body || '',
      tag: data.tag || undefined, // same tag => duplicates collapse on the device
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      lang: data.lang || 'fr',
      data: { target: data.target, ref: data.ref },
    });
  });
}
