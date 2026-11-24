import type { Rol } from '../common/roles';

/** Nunca incluye password_hash: es la única proyección que sale de la API. */
export interface UsuarioGestion {
  id: number;
  username: string;
  rol: Rol;
  activo: boolean;
}
