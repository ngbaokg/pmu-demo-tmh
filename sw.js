// Service Worker - Hỗ trợ PWA mở ứng dụng mượt mà, lưu bộ đệm tĩnh (HTML/CSS/Icon)
// Mỗi lần muốn ép máy bỏ bộ đệm cũ, chỉ cần đổi số phiên bản bên dưới (v2 -> v3 -> ...)
const CACHE_NAME = 'pmu-pro-saas-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Thiếu 1 file (vd: icon) cũng không làm hỏng việc cài đặt
      Promise.all(CORE_ASSETS.map((u) => cache.add(u).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Bỏ qua các yêu cầu đến Firebase/Google API để tránh xung đột dữ liệu trực tiếp
  const url = event.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // Trang chính luôn hỏi lại máy chủ để nhận bản mới nhất, không dùng bộ nhớ tạm của trình duyệt
  const req = event.request.mode === 'navigate'
    ? new Request(event.request, { cache: 'no-cache' })
    : event.request;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Chỉ lưu các phản hồi hợp lệ, tránh lưu trang lỗi 404/500
        if (response && (response.ok || response.type === 'opaque')) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
