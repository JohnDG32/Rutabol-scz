import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

interface UsuarioRow { id: number; username: string; password_hash: string; rol: 'ADMIN' }

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password || password.length < 12) {
      throw new Error('Configura ADMIN_USERNAME y ADMIN_PASSWORD (12 caracteres como mínimo) en backend/.env');
    }
    const hashSeguro = await hash(password, 12);
    await this.db.query(
      `INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (username) DO NOTHING`,
      [username, hashSeguro]
    );
  }

  async validar(username: string, password: string): Promise<{ id: number; username: string; rol: 'ADMIN' }> {
    const rows = await this.db.query<UsuarioRow>(
      'SELECT id, username, password_hash, rol FROM usuarios WHERE username = $1',
      [username]
    );
    const usuario = rows[0];
    if (!usuario || !(await compare(password, usuario.password_hash))) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    return { id: usuario.id, username: usuario.username, rol: usuario.rol };
  }
}
