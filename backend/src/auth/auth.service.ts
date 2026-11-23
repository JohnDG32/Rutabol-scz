import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { Rol } from '../common/roles';

interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  rol: Rol;
}

export interface UsuarioAutenticado {
  id: number;
  username: string;
  rol: Rol;
}

const FOTO_DEMO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password || password.length < 12) {
      throw new Error('Configura ADMIN_USERNAME y ADMIN_PASSWORD (12 caracteres como mínimo) en backend/.env');
    }
    await this.crearUsuarioSiFalta(username, password, 'ADMIN');
    await this.sembrarUsuariosDemo();
  }

  /** Usuarios de demostración para probar los cuatro roles sin registro público. */
  private async sembrarUsuariosDemo(): Promise<void> {
    const claveDemo = process.env.RUTABOL_DEMO_PASSWORD || 'RutabolDemo123';
    if (claveDemo.length < 12) {
      throw new Error('RUTABOL_DEMO_PASSWORD debe tener al menos 12 caracteres');
    }

    const usuarios: Array<{ username: string; rol: Rol }> = [
      { username: 'conductor1', rol: 'CONDUCTOR' },
      { username: 'pasajero1', rol: 'PASAJERO' },
      { username: 'estudiante1', rol: 'ESTUDIANTE' },
    ];
    for (const usuario of usuarios) {
      await this.crearUsuarioSiFalta(usuario.username, claveDemo, usuario.rol);
    }

    const rows = await this.db.query<{ id: number }>(
      'SELECT id FROM usuarios WHERE username = $1', ['conductor1']
    );
    const conductorId = rows[0]?.id;
    if (conductorId) {
      await this.db.query(
        `INSERT INTO conductores (usuario_id, nombre, apellido, ci, telefono, micro_id, activo)
         SELECT $1, 'Juan', 'Pérez', 'DEMO-CI-C1', '70000001', m.id, TRUE
         FROM micros m WHERE m.interno = '101'
         AND NOT EXISTS (SELECT 1 FROM conductores c WHERE c.usuario_id = $1)`,
        [conductorId]
      );
    }

    const estudiante = await this.db.query<{ id: number }>(
      'SELECT id FROM usuarios WHERE username = $1', ['estudiante1']
    );
    const estudianteId = estudiante[0]?.id;
    if (estudianteId) {
      await this.db.query(
        `INSERT INTO estudiantes
           (usuario_id, nombre, apellido, ci, categoria, codigo, correo_institucional, foto_url, verificado)
         SELECT $1, 'Ana', 'Rodríguez', 'DEMO-CI-E1', 'UNIVERSITARIO', 'UPDS-2026-001',
                'ana.rodriguez@upds.edu.bo', $2, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM estudiantes e WHERE e.usuario_id = $1)`,
        [estudianteId, FOTO_DEMO]
      );
    }
  }

  private async crearUsuarioSiFalta(username: string, password: string, rol: Rol): Promise<void> {
    const existe = await this.db.query<{ id: number }>(
      'SELECT id FROM usuarios WHERE username = $1', [username]
    );
    if (existe.length) return;
    const hashSeguro = await hash(password, 12);
    await this.db.query(
      'INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
      [username, hashSeguro, rol]
    );
  }

  async validar(username: string, password: string): Promise<UsuarioAutenticado> {
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
