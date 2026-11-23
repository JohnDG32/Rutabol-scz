import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Comprueba únicamente que exista una sesión; el rol lo valida RolesGuard. */
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.usuarioId) throw new UnauthorizedException('Debe iniciar sesión');
    return true;
  }
}
