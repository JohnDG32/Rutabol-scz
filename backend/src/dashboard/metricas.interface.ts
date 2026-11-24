import type { Rol } from '../common/roles';

/** Resumen que consume el /dashboard. Nunca expone datos personales ni claves. */
export interface MetricasDashboard {
  rol: Rol;
  lineas: number;
  micros: number;
  microsDisponibles: number;
  conductores: number;
  viajesActivos: number;
  pagosHoy: number;
  recaudadoHoyBs: number;
  usuariosActivos?: number;
  usuariosInactivos?: number;
  estudiantesVerificados?: number;
  misViajesActivos?: number;
  misAbordajesHoy?: number;
  posicionesHoy?: number;
  misPagos?: number;
  misPagosConfirmados?: number;
  miGastoBs?: number;
  tarifasVigentes?: number;
}
