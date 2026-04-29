/* ══════════════════════════════════════════════════
   Service Worker — أكاديمية الشبكات PWA
   استراتيجية: Network First مع Fallback للكاش
══════════════════════════════════════════════════ */
const CACHE_NAME = "nw-academy-v1";
const PRECACHE = [
  "./index.html",
  "./login.html",
  "./trainee.html",
  "./style.css",
  "./shared-nav.js",
  "./shared-theme.js",
  "./login.js"
];

/* ── التثبيت: تخزين الملفات الأساسية ── */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── التفعيل: حذف الكاش القديم ── */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── جلب: Network First ── */
self.addEventListener("fetch", e => {
  // تجاهل طلبات Firebase و APIs الخارجية
  if (e.request.url.includes("firebasestorage") ||
      e.request.url.includes("firebaseio") ||
      e.request.url.includes("googleapis") ||
      e.request.url.includes("gstatic") ||
      e.request.url.includes("fonts.google") ||
      e.request.url.includes("cdnjs.cloudflare") ||
      e.request.url.includes("cdn.tiny") ||
      e.request.method !== "GET") {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // تخزين النسخة الجديدة
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
