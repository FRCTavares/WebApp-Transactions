// Minimal hand-rolled service worker for real (not just installable) offline
// support. No build-time precache manifest is generated - static assets and
// API GET responses are cached opportunistically as they are fetched
// (network-first, falling back to cache when offline). Non-GET requests are
// never intercepted, so writes fail naturally and surface through the app's
// existing error handling.
//
// Bump these version strings whenever the caching strategy changes, so old
// caches are cleaned up on activate.
const STATIC_CACHE_NAME = 'finance-static-v1'
const API_CACHE_NAME = 'finance-api-v1'
const CURRENT_CACHES = new Set([STATIC_CACHE_NAME, API_CACHE_NAME])

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CURRENT_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

async function networkFirstWithCacheFallback(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)

    if (response && response.ok && response.type !== 'opaque') {
      await cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cached = await cache.match(request)

    if (cached) {
      return cached
    }

    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (!url.protocol.startsWith('http')) {
    return
  }

  const cacheName = isApiRequest(url) ? API_CACHE_NAME : STATIC_CACHE_NAME

  event.respondWith(networkFirstWithCacheFallback(request, cacheName))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE_NAME))
  }
})
