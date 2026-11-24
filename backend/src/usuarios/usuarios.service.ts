import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioGestion } from './usuario.interface';

const COLUMNAS = 'id, username, rol, activo';

@Injectable()
export class UsuariosService {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Promise<UsuarioGestion[]> {
    return this.db.query<UsuarioGestion>(`SELECT ${COLUMNAS} FROM usuarios ORDER BY id`);
  }

  async findOne(id: number): Promise<UsuarioGestion> {
    const rows = await this.db.query<UsuarioGestion>(`SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El usuario no existe');
    return rows[0];
  }

  private mapearError(error: unknown): never {
    const codigo = (error as { code?: string })?.code;
    if (codigo === '23505') throw new ConflictException('El nombre de usuario ya está registrado');
    throw error;
  }

  /** No se permite dejar la instalación sin ningún administrador activo. */
  private async quedaOtroAdmin(id: number): Promise<boolean> {
    const rows = await this.db.query<{ ok: number }>(
      `SELECT 1 AS ok FROM usuarios
       WHERE rol = 'ADMIN' AND activo = TRUE AND id <> $1 LIMIT 1`, [id]
    );
    return rows.length > 0;
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioGestion> {
    const hashSeguro = await hash(dto.password, 12);
    try {
      const rows = await this.db.query<{ id: number }>(
        `INSERT INTO usuarios (username, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [dto.username.trim(), hashSeguro, dto.rol, dto.activo ?? true]
      );
      return this.findOne(rows[0].id);
    } catch (error) { return this.mapearError(error); }
  }

  async update(id: number, dto: UpdateUsuarioDto, sesionId: number): Promise<UsuarioGestion> {
    const actual = await this.findOne(id);

    if (id === sesionId && dto.activo === false) {
      throw new BadRequestException('No puede desactivar su propio usuario');
    }
    if (id === sesionId && dto.rol !== undefined && dto.rol !== actual.rol) {
      throw new BadRequestException('No puede cambiar su propio rol');
    }
    const pierdeAdmin = actual.rol === 'ADMIN' && (dto.activo === false || (dto.rol !== undefined && dto.rol !== 'ADMIN'));
    if (pierdeAdmin && !(await this.quedaOtroAdmin(id))) {
      throw new BadRequestException('Debe quedar al menos un administrador activo');
    }

    const sets: string[] = [];
    const parametros: unknown[] = [];
    const agregar = (columna: string, valor: unknown) => {
      parametros.push(valor);
      sets.push(`${columna} = $${parametros.length}`);
    };
    agregar('username', dto.username !== undefined ? dto.username.trim() : actual.username);
    agregar('rol', dto.rol ?? actual.rol);
    agregar('activo', dto.activo ?? actual.activo);
    if (dto.password !== undefined) agregar('password_hash', await hash(dto.password, 12));
    parametros.push(id);

    try {
      await this.db.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${parametros.length}`, parametros);
      return this.findOne(id);
    } catch (error) { return this.mapearError(error); }
  }

  /** Baja lógica: conserva el usuario para no romper los registros históricos. */
  async desactivar(id: number, sesionId: number): Promise<void> {
    const actual = await this.findOne(id);
    if (id === sesionId) throw new BadRequestException('No puede desactivar su propio usuario');
    if (!actual.activo) return;
    if (actual.rol === 'ADMIN' && !(await this.quedaOtroAdmin(id))) {
      throw new BadRequestException('Debe quedar al menos un administrador activo');
    }
    await this.db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [id]);
  }
}
