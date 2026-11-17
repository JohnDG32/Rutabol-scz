import { Linea, Micro, MicroInput } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new Error('No se puede conectar con NestJS. Comprueba que el backend esté ejecutándose en el puerto 3001.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new Error(detail || `Error HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  lineas: () => request<Linea[]>('/lineas'),
  micros: () => request<Micro[]>('/micros'),
  crearMicro: (data: MicroInput) => request<Micro>('/micros', { method: 'POST', body: JSON.stringify(data) }),
  actualizarMicro: (id: number, data: MicroInput) =>
    request<Micro>(`/micros/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminarMicro: (id: number) => request<void>(`/micros/${id}`, { method: 'DELETE' }),
};
