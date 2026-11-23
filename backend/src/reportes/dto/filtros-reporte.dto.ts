import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { FiltrosReporte } from '../reporte.interface';

export class FiltrosReporteDto implements FiltrosReporte {
  @IsOptional() @IsDateString()
  desde?: string;

  @IsOptional() @IsDateString()
  hasta?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  lineaId?: number;
}
