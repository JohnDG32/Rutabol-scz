import type { CategoriaTarifa } from '../common/roles';

export type EstadoPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';

export interface Pago {
  id: number;
  usuarioId: number | null;
  viajeId: number;
  monto: number;
  categoria: CategoriaTarifa;
  metodo: 'SIMULADO' | 'TARJETA' | 'STRIPE';
  estado: EstadoPago;
  referencia: string;
  stripeSesionId: string | null;
  creadoEn: string;
  confirmadoEn: string | null;
}
