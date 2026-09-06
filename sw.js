const CACHE="splendor-v3-9-2";
const ASSETS=[
  "./","./index.html","./style.css","./app.js","./data.js","./manifest.json",
  "./favicon.ico",
  "./icons/icon-48.png","./icons/icon-72.png","./icons/icon-96.png",
  "./icons/icon-128.png","./icons/icon-144.png","./icons/icon-152.png",
  "./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png",
  "./icons/icon-maskable-192.png","./icons/icon-maskable-512.png"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
