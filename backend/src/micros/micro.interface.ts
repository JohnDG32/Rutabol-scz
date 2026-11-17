export type EstadoMicro = 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';

export interface Micro {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  estado: EstadoMicro;
  lineaId: number;
}
