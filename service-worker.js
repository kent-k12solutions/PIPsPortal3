const CACHE_VERSION = 'pips-portal-cache-v1';
const CONFIG_CACHE_VERSION = 'pips-portal-config-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/admin.html',
  '/admin.js',
  '/manifest.json',
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
  const allowedCaches = [CACHE_VERSION, CONFIG_CACHE_VERSION];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !allowedCaches.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

const CONFIG_PATH = '/config.json';

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'PORTAL_CONFIG_UPDATE') {
    const replyPort = event.ports && event.ports[0];
    event.waitUntil(
      storeConfigOverride(data.payload)
        .then(() => {
          if (replyPort) {
            replyPort.postMessage({ success: true });
          }
        })
        .catch((error) => {
          console.error('Failed to update cached config.json.', error);
          if (replyPort) {
            replyPort.postMessage({ success: false, error: error && error.message ? error.message : String(error) });
          }
        })
    );
  } else if (data.type === 'PORTAL_CONFIG_CLEAR') {
    const replyPort = event.ports && event.ports[0];
    event.waitUntil(
      clearConfigOverride()
        .then(() => {
          if (replyPort) {
            replyPort.postMessage({ success: true });
          }
        })
        .catch((error) => {
          console.error('Failed to clear cached config.json override.', error);
          if (replyPort) {
            replyPort.postMessage({ success: false, error: error && error.message ? error.message : String(error) });
          }
        })
    );
  }
});

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
    event.respondWith(handleConfigRequest(request));
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

async function networkFirst(request, { cacheOverride = 'default', shouldCache = true } = {}) {
  try {
    const fetchOptions = {};
    if (cacheOverride && cacheOverride !== 'default') {
      fetchOptions.cache = cacheOverride;
    }
    const networkResponse = Object.keys(fetchOptions).length
      ? await fetch(request, fetchOptions)
      : await fetch(request);
    if (shouldCache) {
      cacheResponse(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (shouldCache) {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
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

async function handleConfigRequest(request) {
  const cache = await caches.open(CONFIG_CACHE_VERSION);
  const cached = await cache.match(CONFIG_PATH);
  const isOverride = cached && cached.headers.get('X-Portal-Config-Override') === 'true';
  if (isOverride) {
    return cached.clone();
  }

  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    await cache.put(CONFIG_PATH, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    if (cached) {
      return cached.clone();
    }
    throw error;
  }
}

async function storeConfigOverride(configData) {
  const cache = await caches.open(CONFIG_CACHE_VERSION);
  const body = typeof configData === 'string' ? configData : JSON.stringify(configData);
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Portal-Config-Override': 'true'
    }
  });
  await cache.put(CONFIG_PATH, response);
}

async function clearConfigOverride() {
  const cache = await caches.open(CONFIG_CACHE_VERSION);
  await cache.delete(CONFIG_PATH);
}
