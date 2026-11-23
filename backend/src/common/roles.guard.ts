import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, Rol } from './roles';

/**
 * Guard global: solo exige sesión cuando el endpoint declara @Roles(...).
 * Las consultas públicas no llevan la decoración y siguen siendo accesibles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.usuarioId) throw new UnauthorizedException('Debe iniciar sesión');
    if (!roles.includes(req.session.rol as Rol)) {
      throw new ForbiddenException('Su rol no tiene permisos para esta operación');
    }
    return true;
  }
}
