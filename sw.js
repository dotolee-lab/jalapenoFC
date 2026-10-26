// 할라피뇨FC 앱 서비스 워커
// - 화면(index.html)은 항상 새 버전을 먼저 받아오고, 인터넷이 끊겼을 때만 저장본을 보여줘요.
// - 선수·기록 데이터(Supabase)는 저장하지 않아요. 항상 최신으로 불러와요.
const CACHE = 'jalapeno-v17';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png', './logo-dark.png', './logo-light.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;            // 데이터·사진은 그대로 인터넷에서
  // 화면: 인터넷 먼저 → 실패하면 저장본
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // 아이콘·라이브러리(jsdelivr/unpkg): 저장본 먼저, 뒤에서 새로 받아 갱신
  if (url.origin === location.origin || /(jsdelivr\.net|unpkg\.com)$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
