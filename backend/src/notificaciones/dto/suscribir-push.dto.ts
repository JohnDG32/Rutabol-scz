import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SuscribirPushDto {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  endpoint!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  p256dh!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  auth!: string;
}

export class DesuscribirPushDto {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  endpoint!: string;
}
