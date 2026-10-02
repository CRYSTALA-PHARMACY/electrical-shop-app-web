/* ─── Service Worker: تطبيق محل الأدوات الكهربائية (أوفلاين 100%) ───
   ملاحظات:
   - كل المسارات نسبية (./) ليعمل التطبيق تحت أي مسار فرعي (GitHub Pages basePath).
   - 'eshop-1790929044813' يستبدله scripts/patch-sw.js وقت البناء برقم فريد،
     وبهذا يحدّث المستخدمون الكاش تلقائياً مع كل نشر بدون تعديل يدوي. */
const CACHE = 'eshop-1790929044813';
const APP_SHELL = ['./', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // التنقل بين الصفحات: شبكة أولًا ثم الكاش (ليعمل التطبيق أوفلاين)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then((r) => r || caches.match(req)))
    );
    return;
  }

  // الأصول: كاش أولًا ثم تحديث بالخلفية
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

// ─── المرحلة 10: الإشعارات الفورية (Web Push) ───
// الحمولة JSON من وسيط المحل: {title, body, tag, url?, view?, urgent?}
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'تحديث', body: e.data ? e.data.text() : 'لديك تحديث جديد' };
  }
  const title = data.title || 'محل الأدوات الكهربائية';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,          // نفس الطلب لا يكدّس إشعاراته
      renotify: !!data.tag,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url || './', view: data.view || undefined },
    })
  );
});

// فتح/تركيز التطبيق عند لمس الإشعار — والتنقل الداخلي برسالة للصفحة
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (all.length > 0) {
        const client = all[0];
        try { await client.focus(); } catch { /* قد يفشل التركيز — سنفتح نافذة */ }
        client.postMessage({ type: 'push-navigate', view: e.notification.data?.view, url: e.notification.data?.url });
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
