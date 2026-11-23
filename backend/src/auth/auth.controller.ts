import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const usuario = await this.auth.validar(dto.username, dto.password);
    // Regenerar el identificador previene reutilizar una sesión anterior.
    await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.usuarioId = usuario.id;
    req.session.username = usuario.username;
    req.session.rol = usuario.rol;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return usuario;
  }

  @Get('me')
  me(@Req() req: Request) {
    if (!req.session.usuarioId) throw new UnauthorizedException('No existe sesión activa');
    return { id: req.session.usuarioId, username: req.session.username, rol: req.session.rol };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
    res.clearCookie('rutabol.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: false });
    return { mensaje: 'Sesión finalizada' };
  }
}
