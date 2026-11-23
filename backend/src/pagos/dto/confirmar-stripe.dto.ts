import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmarStripeDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  sessionId!: string;
}
