// إشعارات الدفع (Web Push) — يُضمَّن داخل Service Worker الذي يولّده vite-plugin-pwa (workbox.importScripts)
// يعمل والتطبيق مغلق أو الشاشة مطفأة.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }

  const title = data.title || 'واسط'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/notifications' },
  }))
})

// الضغط على الإشعار: يفتح الصفحة المرتبطة (أو يركّز تبويباً مفتوحاً وينقله إليها)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = windows.find(w => new URL(w.url).origin === self.location.origin)
    if (client) {
      await client.focus()
      if ('navigate' in client) return client.navigate(target)
      return
    }
    return self.clients.openWindow(target)
  })())
})
