import { Controller, Get, Param, ParseIntPipe, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificacionesService } from './notificaciones.service';
import { Roles, TODOS_LOS_ROLES } from '../common/roles';
import { Notificacion } from './notificacion.interface';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get() @Roles(...TODOS_LOS_ROLES)
  listar(@Req() req: Request): Promise<Notificacion[]> {
    return this.service.listar(Number(req.session?.usuarioId), req.session?.rol ?? 'PASAJERO');
  }

  @Patch(':id/leida') @Roles(...TODOS_LOS_ROLES)
  marcarLeida(@Param('id', ParseIntPipe) id: number): Promise<Notificacion> {
    return this.service.marcarLeida(id);
  }
}
