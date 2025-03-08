// 缓存名称和版本
const CACHE_NAME = 'ai-chat-assistant-v2';

// 需要缓存的资源列表
const urlsToCache = [
  '/',
  '/static/css/styles.css',
  '/static/css/mobile-responsive.css',
  '/static/css/markdown-styles.css',
  '/static/css/splash-screen.css',
  '/static/js/script.js',
  '/static/js/inputRenderer.js',
  '/static/js/mobile-responsive.js',
  '/static/js/pwa-enhancements.js',
  '/static/icons/models/xai.svg',
  '/static/icons/users/default_profile.svg',
  '/static/icons/pwa/splash-640x1136.png',
  '/static/icons/pwa/splash-750x1334.png',
  '/static/icons/pwa/splash-1242x2208.png',
  '/static/icons/pwa/splash-1125x2436.png',
  '/static/icons/pwa/splash-1536x2048.png',
  '/static/icons/pwa/splash-1668x2224.png',
  '/static/icons/pwa/splash-2048x2732.png',
  '/static/icons/pwa/icon-192x192.png',
  '/static/icons/pwa/icon-512x512.png',
  // 添加其他需要缓存的资源
];

// 安装Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存创建成功');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('预缓存失败:', error);
      })
  );
});

// 激活Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 删除旧版本缓存
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 处理资源请求
self.addEventListener('fetch', event => {
  // 网络优先策略
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 请求成功，复制响应并存入缓存
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            // 只缓存GET请求
            if (event.request.method === 'GET') {
              cache.put(event.request, responseClone);
            }
          });
        return response;
      })
      .catch(() => {
        // 网络请求失败，尝试从缓存获取
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // 对于HTML请求，返回离线页面
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
            return new Response('资源不可用，网络离线', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
}); 