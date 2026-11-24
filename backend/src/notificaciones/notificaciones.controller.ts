import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesExternasService } from './notificaciones-externas.service';
import { SuscribirPushDto, DesuscribirPushDto } from './dto/suscribir-push.dto';
import { Roles, TODOS_LOS_ROLES } from '../common/roles';
import { Notificacion } from './notificacion.interface';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly service: NotificacionesService,
    private readonly externas: NotificacionesExternasService,
  ) {}

  /** El panel consulta esto para saber si ofrece el botón de activar push.
   *  Es público, igual que /pagos/config: solo expone la clave VAPID pública. */
  @Get('config')
  configuracion() { return this.externas.configuracion(); }

  @Post('suscribir') @Roles(...TODOS_LOS_ROLES)
  suscribir(@Body() dto: SuscribirPushDto, @Req() req: Request) {
    return this.externas.suscribir(Number(req.session?.usuarioId), dto);
  }

  @Post('desuscribir') @Roles(...TODOS_LOS_ROLES)
  desuscribir(@Body() dto: DesuscribirPushDto, @Req() req: Request) {
    return this.externas.desuscribir(Number(req.session?.usuarioId), dto.endpoint);
  }

  /** Extra: dispara un aviso de prueba para verificar push/correo sin provocar una emergencia. */
  @Post('prueba') @Roles(...TODOS_LOS_ROLES)
  prueba(@Req() req: Request): Promise<Notificacion> {
    return this.service.crear(
      'PASAJEROS',
      'PRUEBA',
      'Notificación de prueba enviada desde el panel de RUTABOL-SCZ.',
      Number(req.session?.usuarioId),
    );
  }

  @Get() @Roles(...TODOS_LOS_ROLES)
  listar(@Req() req: Request): Promise<Notificacion[]> {
    return this.service.listar(Number(req.session?.usuarioId), req.session?.rol ?? 'PASAJERO');
  }

  @Patch(':id/leida') @Roles(...TODOS_LOS_ROLES)
  marcarLeida(@Param('id', ParseIntPipe) id: number): Promise<Notificacion> {
    return this.service.marcarLeida(id);
  }
}
