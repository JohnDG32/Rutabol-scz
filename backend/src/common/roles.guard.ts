import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { ROLES_KEY, Rol } from './roles';

/**
 * Guard global: solo exige sesión cuando el endpoint declara @Roles(...).
 * Las consultas públicas no llevan la decoración y siguen siendo accesibles.
 * El rol y el estado se leen de PostgreSQL, no de la sesión: así un cambio de
 * rol o una baja surte efecto aunque la cookie siga viva.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.usuarioId) throw new UnauthorizedException('Debe iniciar sesión');

    const rows = await this.db.query<{ rol: Rol; activo: boolean }>(
      'SELECT rol, activo FROM usuarios WHERE id = $1', [req.session.usuarioId]
    );
    const usuario = rows[0];
    if (!usuario) throw new UnauthorizedException('El usuario ya no existe');
    if (!usuario.activo) throw new UnauthorizedException('El usuario está desactivado');
    if (!roles.includes(usuario.rol)) {
      throw new ForbiddenException('Su rol no tiene permisos para esta operación');
    }
    return true;
  }
}
