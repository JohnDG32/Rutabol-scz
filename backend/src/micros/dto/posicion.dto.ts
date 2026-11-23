import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class PosicionDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional() @IsString() @MaxLength(40)
  origen?: string;
}
