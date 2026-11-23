import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/** RF-06/RNF-16: avisa a todos los navegadores cuando cambia un dato operativo. */
@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test',
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer() private readonly server?: Server;

  emitirCambio(detalle: { entidad: string; accion: string; usuario?: string }): void {
    this.server?.emit('cambios', {
      ...detalle,
      momento: new Date().toISOString(),
    });
  }
}
