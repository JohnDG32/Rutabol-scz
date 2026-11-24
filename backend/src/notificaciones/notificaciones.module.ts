import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesExternasService } from './notificaciones-externas.service';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesExternasService],
  exports: [NotificacionesService, NotificacionesExternasService],
})
export class NotificacionesModule {}
