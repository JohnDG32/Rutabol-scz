import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTarifaDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  monto?: number;

  @IsOptional() @IsBoolean()
  activa?: boolean;
}
