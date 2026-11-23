import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ValidarEstudianteDto {
  @IsIn(['ESCOLAR', 'UNIVERSITARIO'])
  categoria!: 'ESCOLAR' | 'UNIVERSITARIO';

  @IsString() @IsNotEmpty() @MaxLength(50)
  codigo!: string;

  @IsOptional() @IsString()
  fotoUrl?: string;
}
