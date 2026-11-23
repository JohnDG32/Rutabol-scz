import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLineaDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  zona!: string;

  @IsString() @IsNotEmpty()
  descripcion!: string;

  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/)
  color!: string;
}
