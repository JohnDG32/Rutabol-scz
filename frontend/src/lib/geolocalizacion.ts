export const UBICACION_DEMO = { lat: -17.7833, lng: -63.1821 };

export type OrigenUbicacion = 'GPS_NAVEGADOR' | 'DEMO' | 'MANUAL';

export interface Ubicacion {
  lat: number;
  lng: number;
  precision: number | null;
  origen: OrigenUbicacion;
}

export function ubicacionDemo(): Ubicacion {
  return { ...UBICACION_DEMO, precision: null, origen: 'DEMO' };
}

function mensajeDelError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Permiso de ubicación denegado. Habilite el GPS para este sitio en el navegador.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'El dispositivo no pudo determinar su ubicación.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Se agotó el tiempo de espera para obtener la ubicación.';
  }
  return 'No se pudo obtener la ubicación del navegador.';
}

/** RF-06/RNF-05: ubicación real del dispositivo. Requiere HTTPS o localhost. */
export function obtenerUbicacion(): Promise<Ubicacion> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Este navegador no ofrece geolocalización. Puede escribir las coordenadas a mano.'));
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return Promise.reject(new Error('El GPS del navegador requiere HTTPS. Abra https://rutabol-scz-8ih4.vercel.app.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (posicion) => resolve({
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude,
        precision: Math.round(posicion.coords.accuracy),
        origen: 'GPS_NAVEGADOR',
      }),
      (error) => reject(new Error(mensajeDelError(error))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}
