export type Rol = 'ADMIN' | 'CONDUCTOR' | 'PASAJERO' | 'ESTUDIANTE';
export type Categoria = 'GENERAL' | 'ESCOLAR' | 'UNIVERSITARIO';
export type EstadoMicro = 'DISPONIBLE' | 'EN_CIRCULACION' | 'LLENO' | 'FUERA_DE_SERVICIO' | 'EMERGENCIA';

export interface Usuario { id: number; username: string; rol: Rol }

export interface Linea {
  id: number;
  nombre: string;
  zona: string;
  descripcion: string;
  color: string;
}

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

export type MicroInput = Omit<Micro, 'id' | 'ocupacion'>;

export interface Conductor {
  id: number;
  usuarioId: number | null;
  nombre: string;
  apellido: string;
  ci: string;
  telefono: string | null;
  microId: number | null;
  microInterno: string | null;
  activo: boolean;
}

export type ConductorInput = Pick<Conductor, 'nombre' | 'apellido' | 'ci' | 'telefono' | 'microId' | 'activo'>;

export interface Tarifa {
  id: number;
  lineaId: number;
  categoria: Categoria;
  monto: number;
  vigenteDesde: string;
  activa: boolean;
}

export interface Estudiante {
  id: number;
  usuarioId: number | null;
  nombre: string;
  apellido: string;
  ci: string;
  categoria: 'ESCOLAR' | 'UNIVERSITARIO';
  codigo: string;
  correoInstitucional: string | null;
  fotoUrl: string;
  verificado: boolean;
  creadoEn: string;
}

export interface Pago {
  id: number;
  usuarioId: number | null;
  viajeId: number;
  monto: number;
  categoria: Categoria;
  metodo: 'SIMULADO' | 'TARJETA' | 'STRIPE';
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
  referencia: string;
  stripeSesionId: string | null;
  creadoEn: string;
  confirmadoEn: string | null;
}

export interface Viaje {
  id: number;
  microId: number;
  conductorId: number;
  lineaId: number;
  tipo: 'NORMAL' | 'EMERGENCIA';
  estado: 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
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
  categoria: Categoria;
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
  tipo: 'NORMAL' | 'EMERGENCIA';
  motivo: string | null;
  pagoReutilizado: boolean;
  creadoEn: string;
}

export interface Historial {
  viajes: Viaje[];
  pagos: Pago[];
  trasbordos: Trasbordo[];
  abordajes: Abordaje[];
}

export interface Notificacion {
  id: number;
  destino: 'PASAJEROS' | 'ADMIN' | 'CONDUCTOR';
  tipo: string;
  mensaje: string;
  usuarioId: number | null;
  leida: boolean;
  creadoEn: string;
}

export interface ConfigNotificaciones {
  push: boolean;
  correo: 'DESACTIVADO' | 'ARCHIVO' | 'SMTP';
  clavePublica: string | null;
}

export interface FiltrosReporte {
  desde?: string;
  hasta?: string;
  lineaId?: number;
}

export interface ResumenReporte {
  micros: { total: number; porEstado: Record<string, number> };
  viajesActivos: number;
  pasajerosHoy: number;
  pagos: { confirmados: number; totalBs: number };
  trasbordos: number;
  emergencias: number;
  ocupacionPromedio: number;
}

export interface ResultadoTrasbordo {
  viajeDestino: Viaje;
  trasbordos: Trasbordo[];
  notificaciones?: number;
}
