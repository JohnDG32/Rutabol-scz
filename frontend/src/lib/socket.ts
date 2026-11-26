import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Cliente único de Socket.IO.
 * En Ruta B la API vive en el túnel HTTPS, no en el origen de Vercel, por eso
 * se deriva el origen del socket de NEXT_PUBLIC_API_URL (se le quita `/api`).
 */
export function obtenerSocket(): Socket {
  if (!socket) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://www.rutabol.test/api';
    const socketOrigin = apiUrl.replace(/\/api\/?$/, '');
    socket = io(socketOrigin, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}
