import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoMicro } from '../micro.interface';

export class UpdateMicroDto {
  @IsOptional() @IsString() @MaxLength(20)
  placa?: string;

  @IsOptional() @IsString() @MaxLength(20)
  interno?: string;

  @IsOptional() @IsInt() @Min(18) @Max(25)
  capacidad?: number;

  @IsOptional() @IsIn(['DISPONIBLE', 'EN_CIRCULACION', 'LLENO', 'FUERA_DE_SERVICIO', 'EMERGENCIA'])
  estado?: EstadoMicro;

  @IsOptional() @IsBoolean()
  autorizado?: boolean;

  @IsOptional() @IsInt() @Min(1)
  lineaId?: number;
}
