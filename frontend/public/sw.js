// Extra: service worker que muestra los avisos Web Push enviados por la API.
self.addEventListener('push', (event) => {
  let datos = {
    title: 'RUTABOL-SCZ',
    body: 'Tenés un aviso nuevo.',
    url: '/#pasajero',
  };
  if (event.data) {
    try {
      datos = { ...datos, ...event.data.json() };
    } catch {
      datos.body = event.data.text();
    }
  }
  event.waitUntil(self.registration.showNotification(datos.title, {
    body: datos.body,
    tag: 'rutabol-aviso',
    data: { url: datos.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/#pasajero';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if (new URL(ventana.url).origin === self.location.origin) {
          ventana.focus();
          return ventana.navigate(destino);
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
