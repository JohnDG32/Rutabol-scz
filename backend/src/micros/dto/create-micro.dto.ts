import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoMicro } from '../micro.interface';

export class CreateMicroDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  placa!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  interno!: string;

  @IsInt() @Min(1) @Max(100)
  capacidad!: number;

  @IsIn(['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'])
  estado!: EstadoMicro;

  @IsInt() @Min(1)
  lineaId!: number;
}
