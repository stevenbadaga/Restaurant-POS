// Restaurant POS Service Worker
// Cache version - increment to force re-cache
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `restaurant-pos-static-${CACHE_VERSION}`;
const MENU_CACHE = `restaurant-pos-menu-${CACHE_VERSION}`;
const API_CACHE = `restaurant-pos-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `restaurant-pos-dynamic-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// Install event - pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('restaurant-pos-') && name !== STATIC_CACHE && name !== MENU_CACHE && name !== API_CACHE && name !== DYNAMIC_CACHE;
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: Network-first strategy (for API requests)
async function networkFirst(request, cacheName, timeoutMs = 5000) {
  try {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      return response;
    }
    throw new Error('Network response was not ok');
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // If no cache, return a fallback
    if (request.url.includes('/api/menu') || request.url.includes('/api/tables')) {
      return new Response(
        JSON.stringify({ success: true, data: [], fromCache: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw err;
  }
}

// Helper: Cache-first strategy (for static assets)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If the request is for a page and not in cache, return offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw err;
  }
}

// Helper: Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Helper: Fetch with timeout
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Helper: Network-only strategy (for mutations)
async function networkOnly(request) {
  const response = await fetch(request);
  return response;
}

// Fetch event - route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations go network-only)
  if (request.method !== 'GET') {
    event.respondWith(networkOnly(request).catch(() => {
      return new Response(
        JSON.stringify({ success: false, message: 'You are offline. This action will be queued and synced when back online.', offline: true }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 }
      );
    }));
    return;
  }

  // Skip socket.io and non-api requests that aren't navigation
  if (url.pathname.includes('/socket.io') || url.pathname.includes('/uploads/')) {
    return;
  }

  // API menu/tables data - network first with menu cache
  if (url.pathname.includes('/api/menu') || url.pathname.includes('/api/tables')) {
    event.respondWith(networkFirst(request, MENU_CACHE, 3000));
    return;
  }

  // Other API GET requests - stale while revalidate with API cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Static assets - cache first with dynamic cache
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/)
  ) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Navigation requests - network first with static cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE, 4000).catch(() => {
      return caches.match('/offline.html');
    }));
    return;
  }

  // Default: network first
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOfflineOrders());
  }
});

async function syncOfflineOrders() {
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_TRIGGERED' });
    }
  } catch (err) {
    console.error('[SW] Sync error:', err);
  }
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      names.filter(n => n.startsWith('restaurant-pos-')).forEach(n => caches.delete(n));
    });
  }
});
