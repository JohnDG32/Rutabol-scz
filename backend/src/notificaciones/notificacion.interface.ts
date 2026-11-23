export type DestinoNotificacion = 'PASAJEROS' | 'ADMIN' | 'CONDUCTOR';

export interface Notificacion {
  id: number;
  destino: DestinoNotificacion;
  tipo: string;
  mensaje: string;
  usuarioId: number | null;
  leida: boolean;
  creadoEn: string;
}
