export interface Linea {
  id: number;
  nombre: string;
  zona: string;
  descripcion: string;
  color: string;
}

export type EstadoMicro = 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';

export interface Micro {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  estado: EstadoMicro;
  lineaId: number;
}

export interface Usuario { id: number; username: string; rol: 'ADMIN' }

export type MicroInput = Omit<Micro, 'id'>;
