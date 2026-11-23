import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { Roles } from '../common/roles';
import { ResumenReporte } from './reporte.interface';
import { FiltrosReporteDto } from './dto/filtros-reporte.dto';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('resumen') @Roles('ADMIN')
  resumen(@Query() filtros: FiltrosReporteDto): Promise<ResumenReporte> {
    return this.service.resumen(filtros);
  }

  @Get('exportar') @Roles('ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rutabol-comprobantes.csv"')
  exportar(@Query() filtros: FiltrosReporteDto): Promise<string> {
    return this.service.exportarCsv(filtros);
  }
}
