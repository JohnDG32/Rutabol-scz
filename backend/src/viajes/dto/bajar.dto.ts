import { IsInt, Min } from 'class-validator';

export class BajarDto {
  @IsInt() @Min(1)
  abordajeId!: number;
}
