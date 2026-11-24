import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TODOS_LOS_ROLES, type Rol } from '../../common/roles';

export class UpdateUsuarioDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'El usuario solo admite letras, números, punto, guion y guion bajo' })
  username?: string;

  @IsOptional() @IsString() @MinLength(12) @MaxLength(200)
  password?: string;

  @IsOptional() @IsIn(TODOS_LOS_ROLES)
  rol?: Rol;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}
