// Network-first with a cache fallback, so a deploy is picked up immediately
// but the app still opens offline. Bump CACHE whenever FILES changes.
const CACHE = 'hybrid-train-v10';
const FILES = [
  './', './index.html', './supabase-config.js', './manifest.webmanifest', './icon.svg',
  './styles/tokens.css', './styles/base.css', './styles/components.css', './styles/screens.css',
  './js/app.js', './js/state.js', './js/actions.js', './js/router.js', './js/program.js',
  './js/ui.js', './js/sky.js', './js/cloud.js', './js/social.js', './js/stats.js',
  './js/screens/home.js', './js/screens/plan.js', './js/screens/log.js', './js/screens/session.js',
  './js/screens/dashboard.js', './js/screens/body.js', './js/screens/settings.js',
  './js/screens/friends.js', './js/screens/ranking.js', './js/screens/auth.js',
  './js/screens/onboarding.js',
];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r })
      .catch(() => caches.match(e.request))
  );
});
