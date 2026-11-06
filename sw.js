// Corner Of The Room – 앱 서비스워커
// 화면 파일만 저장해 두고, 기록 데이터(Supabase)·TMDB는 항상 인터넷에서 새로 받아요.
const VERSION = 'cor-v30';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './favicon.ico',
               './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Supabase, TMDB, CDN은 건드리지 않음

  if (req.mode === 'navigate' || url.pathname.endsWith('.html')){
    // 페이지는 항상 최신 버전 우선, 인터넷이 안 될 때만 저장본
    e.respondWith(fetch(req, { cache:'no-store' }).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // 아이콘 등은 저장본을 먼저 쓰고 뒤에서 갱신
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; });
    return hit || net;
  }));
});
