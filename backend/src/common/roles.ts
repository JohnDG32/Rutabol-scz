import { SetMetadata } from '@nestjs/common';

export type Rol = 'ADMIN' | 'CONDUCTOR' | 'PASAJERO' | 'ESTUDIANTE';
export type CategoriaTarifa = 'GENERAL' | 'ESCOLAR' | 'UNIVERSITARIO';
export type EstadoMicro = 'DISPONIBLE' | 'EN_CIRCULACION' | 'LLENO' | 'FUERA_DE_SERVICIO' | 'EMERGENCIA';

export const ROLES_KEY = 'rutabol_roles';

/** Define los roles autorizados para un controlador o endpoint. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export const TODOS_LOS_ROLES: Rol[] = ['ADMIN', 'CONDUCTOR', 'PASAJERO', 'ESTUDIANTE'];
