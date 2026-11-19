self.addEventListener("push", (event) => {
  const { title, body, path } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icon-192.png", data: path }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data));
});
