import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/roles';
import { DashboardService } from './dashboard.service';
import { MetricasDashboard } from './metricas.interface';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** Métricas separadas por rol: el guard valida sesión, rol y estado en PostgreSQL. */
  @Get('metricas') @Roles('ADMIN', 'CONDUCTOR', 'PASAJERO', 'ESTUDIANTE')
  metricas(@Req() req: Request): Promise<MetricasDashboard> {
    return this.service.obtener(Number(req.session?.usuarioId));
  }
}
