import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Cliente único de Socket.IO: se conecta al mismo origen, sin URL fija. */
export function obtenerSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socket;
}
