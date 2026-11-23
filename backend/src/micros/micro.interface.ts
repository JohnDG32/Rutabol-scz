import type { EstadoMicro } from '../common/roles';

export type { EstadoMicro };

export interface Micro {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  estado: EstadoMicro;
  autorizado: boolean;
  ocupacion: number;
  lineaId: number;
}

export interface MicroCercano extends Micro {
  lat: number;
  lng: number;
  origen: string;
  ultimaPosicion: string;
  distanciaKm: number;
}

export interface Posicion {
  id: number;
  microId: number;
  lat: number;
  lng: number;
  origen: string;
  registradoEn: string;
}
