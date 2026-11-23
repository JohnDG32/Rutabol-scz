import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateEstudianteDto {
  @IsOptional() @IsString() @MaxLength(100)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(100)
  apellido?: string;

  @IsOptional() @IsEmail()
  correoInstitucional?: string;

  @IsOptional() @IsString()
  @Matches(/^(data:image\/|https?:\/\/)/, { message: 'La fotografía debe ser una imagen (data URL o URL)' })
  fotoUrl?: string;

  @IsOptional() @IsBoolean()
  verificado?: boolean;
}
