import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class IniciarViajeDto {
  @IsInt() @Min(1)
  microId!: number;

  @IsOptional() @IsIn(['NORMAL', 'EMERGENCIA'])
  tipo?: 'NORMAL' | 'EMERGENCIA';
}
