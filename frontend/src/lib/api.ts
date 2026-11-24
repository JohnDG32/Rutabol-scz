import type {
  Abordaje, Categoria, ConfigNotificaciones, Conductor, ConductorInput, Estudiante, FiltrosReporte, Historial, Linea,
  Micro, MicroCercano, MicroInput, Notificacion, Pago, ResumenReporte,
  ResultadoTrasbordo, Tarifa, Usuario, UsuarioGestion, UsuarioInput, Viaje,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://www.rutabol.test/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new Error('No se puede conectar con la API RUTABOL-SCZ. Comprueba que el backend esté activo en el puerto 3001.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new Error(detail || `Error HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  // Catálogo y consultas públicas
  lineas: () => request<Linea[]>('/lineas'),
  crearLinea: (data: { nombre: string; zona: string; descripcion: string; color: string }) =>
    request<Linea>('/lineas', json('POST', data)),
  actualizarLinea: (id: number, data: { nombre: string; zona: string; descripcion: string; color: string }) =>
    request<Linea>(`/lineas/${id}`, json('PATCH', data)),
  eliminarLinea: (id: number) => request<void>(`/lineas/${id}`, { method: 'DELETE' }),
  micros: () => request<Micro[]>('/micros'),
  microsCercanos: (lat: number, lng: number, radio = 5) =>
    request<MicroCercano[]>(`/micros/cercanos?lat=${lat}&lng=${lng}&radio=${radio}`),
  tarifas: (lineaId?: number, categoria?: Categoria) =>
    request<Tarifa[]>(`/tarifas${lineaId ? `?lineaId=${lineaId}` : ''}${categoria ? `${lineaId ? '&' : '?'}categoria=${categoria}` : ''}`),

  // Autenticación
  login: (username: string, password: string) =>
    request<Usuario>('/auth/login', json('POST', { username, password })),
  usuarioActual: () => request<Usuario>('/auth/me'),
  logout: () => request<{ mensaje: string }>('/auth/logout', { method: 'POST' }),

  // Usuarios y roles (solo ADMIN)
  usuarios: () => request<UsuarioGestion[]>('/usuarios'),
  crearUsuario: (data: UsuarioInput) => request<UsuarioGestion>('/usuarios', json('POST', data)),
  actualizarUsuario: (id: number, data: Partial<UsuarioInput>) =>
    request<UsuarioGestion>(`/usuarios/${id}`, json('PATCH', data)),
  desactivarUsuario: (id: number) => request<void>(`/usuarios/${id}`, { method: 'DELETE' }),

  // Micros y geolocalización
  crearMicro: (data: MicroInput) => request<Micro>('/micros', json('POST', data)),
  actualizarMicro: (id: number, data: MicroInput) => request<Micro>(`/micros/${id}`, json('PATCH', data)),
  eliminarMicro: (id: number) => request<void>(`/micros/${id}`, { method: 'DELETE' }),
  registrarPosicion: (microId: number, lat: number, lng: number, origen = 'MANUAL') =>
    request<{ id: number; origen: string }>(
      `/micros/${microId}/posicion`, json('POST', { lat, lng, origen })
    ),

  // Conductores
  conductores: () => request<Conductor[]>('/conductores'),
  conductorYo: () => request<Conductor>('/conductores/yo'),
  crearConductor: (data: ConductorInput) => request<Conductor>('/conductores', json('POST', data)),
  actualizarConductor: (id: number, data: Partial<ConductorInput>) =>
    request<Conductor>(`/conductores/${id}`, json('PATCH', data)),
  eliminarConductor: (id: number) => request<void>(`/conductores/${id}`, { method: 'DELETE' }),

  // Tarifas
  crearTarifa: (data: { lineaId: number; categoria: Categoria; monto: number }) =>
    request<Tarifa>('/tarifas', json('POST', data)),
  actualizarTarifa: (id: number, data: { monto?: number; activa?: boolean }) =>
    request<Tarifa>(`/tarifas/${id}`, json('PATCH', data)),
  eliminarTarifa: (id: number) => request<void>(`/tarifas/${id}`, { method: 'DELETE' }),

  // Estudiantes
  estudiantes: () => request<Estudiante[]>('/estudiantes'),
  estudianteYo: () => request<Estudiante | null>('/estudiantes/yo'),
  crearEstudiante: (data: {
    nombre: string; apellido: string; ci: string; categoria: 'ESCOLAR' | 'UNIVERSITARIO';
    codigo: string; correoInstitucional?: string; fotoUrl: string;
  }) => request<Estudiante>('/estudiantes', json('POST', data)),
  validarEstudiante: (data: { categoria: 'ESCOLAR' | 'UNIVERSITARIO'; codigo: string; fotoUrl?: string }) =>
    request<{ valido: true; estudiante: Estudiante }>('/estudiantes/validar', json('POST', data)),
  verificarEstudiante: (id: number) => request<Estudiante>(`/estudiantes/${id}/verificar`, { method: 'POST' }),
  eliminarEstudiante: (id: number) => request<void>(`/estudiantes/${id}`, { method: 'DELETE' }),

  // Pagos (simulado por defecto; Stripe sandbox opcional)
  configPagos: () => request<{ modo: 'SIMULADO' | 'STRIPE'; moneda: string }>('/pagos/config'),
  crearPago: (viajeId: number, categoria: Categoria, token: string) =>
    request<Pago>('/pagos', json('POST', { viajeId, categoria, token })),
  confirmarPago: (id: number) => request<Pago>(`/pagos/${id}/confirmar`, { method: 'POST' }),
  crearCheckout: (id: number) =>
    request<{ pagoId: number; sesionId: string; url: string }>(`/pagos/${id}/checkout`, { method: 'POST' }),
  confirmarStripe: (id: number, sessionId: string) =>
    request<Pago>(`/pagos/${id}/confirmar-stripe`, json('POST', { sessionId })),
  misPagos: () => request<Pago[]>('/pagos/mios'),

  // Viajes, control de pasajeros, trasbordos y emergencias
  viajesActivos: () => request<Viaje[]>('/viajes/activos'),
  historial: () => request<Historial>('/viajes/historial'),
  iniciarViaje: (microId: number) => request<Viaje>('/viajes', json('POST', { microId })),
  abordar: (viajeId: number, pagoId: number, categoria: Categoria, esTrasbordo = false) =>
    request<{ abordaje: Abordaje; ocupacion: number; capacidad: number }>(
      `/viajes/${viajeId}/abordar`, json('POST', { pagoId, categoria, esTrasbordo })
    ),
  bajar: (viajeId: number, abordajeId: number) =>
    request<Abordaje>(`/viajes/${viajeId}/bajar`, json('POST', { abordajeId })),
  finalizarViaje: (viajeId: number) => request<Viaje>(`/viajes/${viajeId}/finalizar`, { method: 'POST' }),
  trasbordo: (viajeId: number, microDestinoId: number, abordajeIds: number[]) =>
    request<ResultadoTrasbordo>(`/viajes/${viajeId}/trasbordo`, json('POST', { microDestinoId, abordajeIds })),
  emergencia: (viajeId: number, microDestinoId: number, motivo: string, abordajeIds: number[]) =>
    request<ResultadoTrasbordo>(`/viajes/${viajeId}/emergencia`, json('POST', { microDestinoId, motivo, abordajeIds })),

  // Notificaciones y reportes
  notificaciones: () => request<Notificacion[]>('/notificaciones'),
  marcarLeida: (id: number) => request<Notificacion>(`/notificaciones/${id}/leida`, { method: 'PATCH' }),
  configNotificaciones: () => request<ConfigNotificaciones>('/notificaciones/config'),
  suscribirPush: (endpoint: string, p256dh: string, auth: string) =>
    request<{ guardada: boolean }>('/notificaciones/suscribir', json('POST', { endpoint, p256dh, auth })),
  desuscribirPush: (endpoint: string) =>
    request<{ borrada: boolean }>('/notificaciones/desuscribir', json('POST', { endpoint })),
  notificacionPrueba: () => request<Notificacion>('/notificaciones/prueba', { method: 'POST' }),
  resumen: (filtros: FiltrosReporte = {}) => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.lineaId) params.set('lineaId', String(filtros.lineaId));
    const query = params.toString();
    return request<ResumenReporte>(`/reportes/resumen${query ? `?${query}` : ''}`);
  },
  exportarReporte: async (filtros: FiltrosReporte = {}): Promise<void> => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.lineaId) params.set('lineaId', String(filtros.lineaId));
    const query = params.toString();
    const url = `${BASE}/reportes/exportar${query ? `?${query}` : ''}`;
    let respuesta: Response;
    try {
      respuesta = await fetch(url, { credentials: 'include', cache: 'no-store' });
    } catch {
      throw new Error('No se pudo conectar con la API RUTABOL-SCZ.');
    }
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      throw new Error(cuerpo?.message ?? `Error HTTP ${respuesta.status}`);
    }
    const contenido = await respuesta.text();
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    enlace.download = 'rutabol-comprobantes.csv';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  },
};
