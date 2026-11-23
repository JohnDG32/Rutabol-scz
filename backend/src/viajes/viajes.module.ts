import { Module } from '@nestjs/common';
import { MicrosModule } from '../micros/micros.module';
import { ConductoresModule } from '../conductores/conductores.module';
import { PagosModule } from '../pagos/pagos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { TarifasModule } from '../tarifas/tarifas.module';
import { EstudiantesModule } from '../estudiantes/estudiantes.module';
import { ViajesController } from './viajes.controller';
import { ViajesService } from './viajes.service';

@Module({
  imports: [MicrosModule, ConductoresModule, PagosModule, NotificacionesModule, TarifasModule, EstudiantesModule],
  controllers: [ViajesController],
  providers: [ViajesService],
  exports: [ViajesService],
})
export class ViajesModule {}
