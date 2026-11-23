export interface ResumenReporte {
  micros: { total: number; porEstado: Record<string, number> };
  viajesActivos: number;
  pasajerosHoy: number;
  pagos: { confirmados: number; totalBs: number };
  trasbordos: number;
  emergencias: number;
  ocupacionPromedio: number;
}

export interface FiltrosReporte {
  desde?: string;
  hasta?: string;
  lineaId?: number;
}
