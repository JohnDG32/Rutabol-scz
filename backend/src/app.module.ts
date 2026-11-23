import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuditoriaModule } from './common/auditoria.module';
import { RolesGuard } from './common/roles.guard';
import { AuditoriaInterceptor } from './common/auditoria.interceptor';
import { LineasModule } from './lineas/lineas.module';
import { MicrosModule } from './micros/micros.module';
import { AuthModule } from './auth/auth.module';
import { ConductoresModule } from './conductores/conductores.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { EstudiantesModule } from './estudiantes/estudiantes.module';
import { PagosModule } from './pagos/pagos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ViajesModule } from './viajes/viajes.module';
import { ReportesModule } from './reportes/reportes.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    DatabaseModule,
    AuditoriaModule,
    LineasModule,
    MicrosModule,
    AuthModule,
    ConductoresModule,
    TarifasModule,
    EstudiantesModule,
    PagosModule,
    NotificacionesModule,
    ViajesModule,
    ReportesModule,
    RealtimeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AppModule {}
