// Service Worker - Hỗ trợ PWA mở ứng dụng mượt mà, lưu bộ đệm tĩnh (HTML/CSS/Icon)
// Mỗi lần muốn ép máy bỏ bộ đệm cũ, chỉ cần đổi số phiên bản bên dưới (v2 -> v3 -> ...)
const CACHE_NAME = 'pmu-pro-saas-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Thư viện bên ngoài mà index.html cần: lưu sẵn để mở app được khi không có mạng
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Thiếu 1 file (vd: icon) cũng không làm hỏng việc cài đặt
      Promise.all([
        ...CORE_ASSETS.map((u) => cache.add(u).catch(() => null)),
        ...CDN_ASSETS.map((u) =>
          fetch(u, { mode: 'no-cors' })
            .then((res) => cache.put(u, res))
            .catch(() => null)
        )
      ])
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
