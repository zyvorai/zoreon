self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("zoreon-shell-v1").then((cache) => cache.addAll(["/", "/favicon.svg"]).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && url.origin === self.location.origin) {
          void caches.open("zoreon-shell-v1").then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match("/") || Response.error();
      }),
  );
});

self.addEventListener("push", (event) => {
  let title = "Zoreon";
  let body = "New activity";
  try {
    const data = event.data?.json() ?? {};
    if (data.title) title = String(data.title);
    if (data.body) body = String(data.body);
  } catch {
    /* */
  }
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/favicon.svg" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
