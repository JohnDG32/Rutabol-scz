import { Controller, Get } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { Roles } from '../common/roles';
import { ResumenReporte } from './reporte.interface';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('resumen') @Roles('ADMIN')
  resumen(): Promise<ResumenReporte> { return this.service.resumen(); }
}
