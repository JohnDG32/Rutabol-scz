import { api } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(normalizado);
  return Uint8Array.from(Array.from(crudo, (caracter) => caracter.charCodeAt(0)));
}

/** Activa Web Push en este navegador y registra la suscripción en la API. */
export async function activarPush(clavePublica: string): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no admite notificaciones push');
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado');

  await navigator.serviceWorker.register('/sw.js');
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(clavePublica),
  });
  const datos = suscripcion.toJSON();
  await api.suscribirPush(datos.endpoint ?? '', datos.keys?.p256dh ?? '', datos.keys?.auth ?? '');
  return datos.endpoint ?? '';
}

export async function desactivarPush(endpoint: string): Promise<void> {
  await api.desuscribirPush(endpoint);
  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  if (suscripcion) await suscripcion.unsubscribe();
}

export async function endpointPushActual(): Promise<string> {
  if (!('serviceWorker' in navigator)) return '';
  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  return suscripcion?.endpoint ?? '';
}
