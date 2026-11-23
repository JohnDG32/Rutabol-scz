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
