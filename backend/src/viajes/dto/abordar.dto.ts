import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CategoriaTarifa } from '../../common/roles';

export class AbordarDto {
  @IsInt() @Min(1)
  pagoId!: number;

  @IsIn(['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'])
  categoria!: CategoriaTarifa;

  @IsOptional() @IsBoolean()
  esTrasbordo?: boolean;
}
