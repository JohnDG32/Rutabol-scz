import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateLineaDto {
  @IsOptional() @IsString() @MaxLength(100)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(80)
  zona?: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
