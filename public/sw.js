/*
 * Service worker Plan Financier — PWA installable + tolérance hors-ligne.
 *
 * Stratégies volontairement simples :
 *   - Navigations (HTML) : réseau d'abord, repli sur le dernier index en cache
 *     (l'app est une SPA locale-first : sans réseau elle reste utilisable).
 *   - Assets same-origin (/assets/, images, css, js) : cache d'abord puis
 *     réseau (les assets Vite sont fingerprintés, donc immuables).
 * Jamais de cache pour les appels cross-origin (Supabase, IA…).
 */
const CACHE_NAME = 'plan-financier-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
