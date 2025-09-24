const CACHE_VERSION = 'pips-portal-cache-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/admin.html',
  '/admin.js',
  '/config.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

const CONFIG_PATH = '/config.json';

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (requestUrl.pathname === CONFIG_PATH) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    cacheResponse(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const fallback = await caches.match('/index.html');
    return fallback || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    cacheResponse(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetch(request);
  cacheResponse(request, networkResponse.clone());
  return networkResponse;
}

function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') {
    return;
  }

  caches.open(CACHE_VERSION).then((cache) => {
    cache.put(request, response);
  });
}
