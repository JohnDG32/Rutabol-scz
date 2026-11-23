import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateEstudianteDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  apellido!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  ci!: string;

  @IsIn(['ESCOLAR', 'UNIVERSITARIO'])
  categoria!: 'ESCOLAR' | 'UNIVERSITARIO';

  /** Código RUDE (escolar) o código de estudiante (universitario). */
  @IsString() @IsNotEmpty() @MaxLength(50)
  codigo!: string;

  @IsOptional() @IsEmail()
  correoInstitucional?: string;

  @IsString() @IsNotEmpty()
  @Matches(/^(data:image\/|https?:\/\/)/, { message: 'La fotografía debe ser una imagen (data URL o URL)' })
  fotoUrl!: string;

  @IsOptional() @IsInt() @Min(1)
  usuarioId?: number;
}
