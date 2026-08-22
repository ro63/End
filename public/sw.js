/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — Service Worker
   ------------------------------------------------------------
   استراتژی: Cache-First برای دارایی‌های استاتیک + Network-First
   برای صفحات. در حالت آفلاین، اپ از کش سرویس شده و داده‌ها
   در Local Queue (IndexedDB/localStorage اپ) نگهداری می‌شوند
   تا هنگام اتصال، Sync خودکار انجام شود.
   ============================================================ */

const CACHE = "nipco-decs-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  /* صفحات: Network-First تا نسخه جدید برسد؛ آفلاین از کش */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
    );
    return;
  }
  /* دارایی‌ها: Cache-First */
  e.respondWith(
    caches.match(e.request).then((m) => m || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => m))
  );
});
