import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { CategoriaTarifa } from '../../common/roles';

export class CreateTarifaDto {
  @IsInt() @Min(1)
  lineaId!: number;

  @IsIn(['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'])
  categoria!: CategoriaTarifa;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  monto!: number;

  @IsOptional() @IsBoolean()
  activa?: boolean;
}
