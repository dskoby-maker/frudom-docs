/* Документы «Фруктовый Дом»: сервис-воркер для установки на телефон.
   Всегда берёт свежую версию из сети; без сети открывает последнюю сохранённую. */
const C = "fd-docs-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["./", "./icon-192.png"]).catch(()=>{}))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; /* таблица и библиотеки — напрямую */
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(u.pathname === "/frudom-docs/app.js" ? "./app.js" : e.request, cp)); } return r; })
    .catch(() => caches.match(u.pathname.endsWith("/app.js") ? "./app.js" : e.request).then(r => r || caches.match("./"))));
});
