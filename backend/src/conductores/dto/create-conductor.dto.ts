import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateConductorDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  apellido!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  ci!: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefono?: string;

  @IsOptional() @IsInt() @Min(1)
  microId?: number;

  @IsOptional() @IsInt() @Min(1)
  usuarioId?: number;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}
