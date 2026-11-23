import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { CategoriaTarifa } from '../../common/roles';

export class CrearPagoDto {
  @IsInt() @Min(1)
  viajeId!: number;

  @IsIn(['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'])
  categoria!: CategoriaTarifa;

  /** Token simulado de tarjeta: nunca se envía ni se guarda el número real. */
  @IsString() @IsNotEmpty() @MaxLength(100)
  token!: string;
}
