import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoMicro } from '../micro.interface';

export class CreateMicroDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  placa!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  interno!: string;

  @IsInt() @Min(18) @Max(25)
  capacidad!: number;

  @IsIn(['DISPONIBLE', 'EN_CIRCULACION', 'LLENO', 'FUERA_DE_SERVICIO', 'EMERGENCIA'])
  estado!: EstadoMicro;

  @IsOptional() @IsBoolean()
  autorizado?: boolean;

  @IsInt() @Min(1)
  lineaId!: number;
}
