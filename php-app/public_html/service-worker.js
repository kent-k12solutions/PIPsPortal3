const APP_CACHE = 'parentidpassport-shell-v1';
const CONFIG_CACHE = 'parentidpassport-config-v1';
const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './styles.css',
  './manifest.json',
  './images/logo.svg',
  './images/background.svg',
  './scripts/main.js',
  './scripts/admin.js',
  './scripts/portal-utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== CONFIG_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.endsWith('config.json')) {
    event.respondWith(fetchConfig(request));
    return;
  }

  if (APP_SHELL.includes(getCacheKey(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data) return;
  if (data.type === 'portal-config-updated') {
    const response = new Response(JSON.stringify(data.payload), {
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Config-Override': 'true'
      }
    });
    event.waitUntil(
      caches.open(CONFIG_CACHE).then((cache) => cache.put(new Request('./config.json'), response))
    );
  }
  if (data.type === 'portal-config-clear') {
    event.waitUntil(
      caches.open(CONFIG_CACHE).then((cache) => cache.delete('./config.json'))
    );
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function fetchConfig(request) {
  const cache = await caches.open(CONFIG_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put('./config.json', response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match('./config.json');
    if (cached) return cached;
    throw error;
  }
}

function getCacheKey(url) {
  if (url.origin !== self.location.origin) return url.href;
  if (url.pathname === '/' || url.pathname === '') return './';
  return `.${url.pathname}`;
}
