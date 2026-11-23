import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MicrosService } from '../micros/micros.service';
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import { Conductor } from './conductor.interface';

const COLUMNAS = `c.id, c.usuario_id AS "usuarioId", c.nombre, c.apellido, c.ci,
  c.telefono, c.micro_id AS "microId", m.interno AS "microInterno", c.activo`;

const DESDE = 'FROM conductores c LEFT JOIN micros m ON m.id = c.micro_id';

@Injectable()
export class ConductoresService {
  constructor(private readonly db: DatabaseService, private readonly micros: MicrosService) {}

  findAll(): Promise<Conductor[]> {
    return this.db.query<Conductor>(`SELECT ${COLUMNAS} ${DESDE} ORDER BY c.id`);
  }

  async findOne(id: number): Promise<Conductor> {
    const rows = await this.db.query<Conductor>(`SELECT ${COLUMNAS} ${DESDE} WHERE c.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El conductor no existe');
    return rows[0];
  }

  async obtenerPorUsuario(usuarioId: number): Promise<Conductor> {
    const rows = await this.db.query<Conductor>(`SELECT ${COLUMNAS} ${DESDE} WHERE c.usuario_id = $1`, [usuarioId]);
    if (!rows[0]) throw new NotFoundException('Su usuario no está registrado como conductor');
    return rows[0];
  }

  private mapearError(error: unknown): never {
    const codigo = (error as { code?: string })?.code;
    if (codigo === '23505') throw new ConflictException('La cédula, el usuario o el micro ya están asignados');
    if (codigo === '23503') throw new BadRequestException('El micro o el usuario seleccionado no existe');
    throw error;
  }

  async create(dto: CreateConductorDto): Promise<Conductor> {
    if (dto.microId !== undefined) await this.micros.findOne(dto.microId);
    try {
      const rows = await this.db.query<{ id: number }>(
        `INSERT INTO conductores (nombre, apellido, ci, telefono, micro_id, usuario_id, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [dto.nombre.trim(), dto.apellido.trim(), dto.ci.trim(), dto.telefono?.trim() || null,
          dto.microId ?? null, dto.usuarioId ?? null, dto.activo ?? true]
      );
      return this.findOne(rows[0].id);
    } catch (error) { return this.mapearError(error); }
  }

  async update(id: number, dto: UpdateConductorDto): Promise<Conductor> {
    const actual = await this.findOne(id);
    if (dto.microId !== undefined && dto.microId !== null) await this.micros.findOne(dto.microId);
    try {
      await this.db.query(
        `UPDATE conductores SET nombre = $1, apellido = $2, telefono = $3,
          micro_id = $4, activo = $5 WHERE id = $6`,
        [dto.nombre ?? actual.nombre, dto.apellido ?? actual.apellido,
          dto.telefono !== undefined ? dto.telefono.trim() || null : actual.telefono,
          dto.microId !== undefined ? dto.microId : actual.microId,
          dto.activo ?? actual.activo, id]
      );
      return this.findOne(id);
    } catch (error) { return this.mapearError(error); }
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM conductores WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('El conductor no existe');
  }
}
