import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateConductorDto {
  @IsOptional() @IsString() @MaxLength(100)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(100)
  apellido?: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefono?: string;

  @IsOptional() @IsInt() @Min(1)
  microId?: number;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}
