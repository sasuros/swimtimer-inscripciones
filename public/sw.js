const CACHE_NAME = 'swimtimer-v2'
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg', '/icons/icon-maskable.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || new URL(request.url).pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
        return response
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  )
  self.clients.claim()
})
