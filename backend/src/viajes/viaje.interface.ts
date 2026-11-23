import type { CategoriaTarifa } from '../common/roles';
import type { Pago } from '../pagos/pago.interface';

export type EstadoViaje = 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
export type TipoViaje = 'NORMAL' | 'EMERGENCIA';

export interface Viaje {
  id: number;
  microId: number;
  conductorId: number;
  lineaId: number;
  tipo: TipoViaje;
  estado: EstadoViaje;
  iniciadoEn: string;
  finalizadoEn: string | null;
  placa?: string;
  interno?: string;
  lineaNombre?: string;
  capacidad?: number;
  ocupacion?: number;
}

export interface Abordaje {
  id: number;
  viajeId: number;
  usuarioId: number | null;
  categoria: CategoriaTarifa;
  pagoId: number;
  estado: 'A BORDO' | 'BAJADO';
  registradoEn: string;
}

export interface Trasbordo {
  id: number;
  viajeOrigenId: number;
  viajeDestinoId: number;
  abordajeId: number;
  usuarioId: number | null;
  tipo: TipoViaje;
  motivo: string | null;
  pagoReutilizado: boolean;
  creadoEn: string;
}

export interface ResultadoTrasbordo {
  viajeDestino: Viaje;
  trasbordos: Trasbordo[];
  notificaciones?: number;
}

export interface Historial {
  viajes: Viaje[];
  pagos: Pago[];
  trasbordos: Trasbordo[];
  abordajes: Abordaje[];
}
