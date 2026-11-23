import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class TrasbordoDto {
  @IsInt() @Min(1)
  microDestinoId!: number;

  @IsArray() @ArrayNotEmpty() @IsInt({ each: true }) @Min(1, { each: true })
  abordajeIds!: number[];
}

export class EmergenciaDto extends TrasbordoDto {
  @IsString() @IsNotEmpty() @MaxLength(250)
  motivo!: string;
}
