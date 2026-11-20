import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LineasService } from '../lineas/lineas.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { Micro } from './micro.interface';

const COLUMNAS = 'id, placa, interno, capacidad, estado, linea_id AS "lineaId"';

@Injectable()
export class MicrosService {
  constructor(private readonly db: DatabaseService, private readonly lineas: LineasService) {}

  findAll(): Promise<Micro[]> {
    return this.db.query<Micro>(`SELECT ${COLUMNAS} FROM micros ORDER BY id`);
  }

  async findOne(id: number): Promise<Micro> {
    const rows = await this.db.query<Micro>(`SELECT ${COLUMNAS} FROM micros WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El micro no existe');
    return rows[0];
  }

  private mapearError(error: unknown): never {
    const codigo = (error as { code?: string })?.code;
    if (codigo === '23505') throw new ConflictException('La placa o el interno ya están registrados');
    if (codigo === '23503') throw new BadRequestException('La línea seleccionada no existe');
    if (codigo === '23514') throw new BadRequestException('Los valores del micro son inválidos');
    throw error;
  }

  async create(dto: CreateMicroDto): Promise<Micro> {
    await this.lineas.findOne(dto.lineaId);
    try {
      const rows = await this.db.query<Micro>(
        `INSERT INTO micros (placa, interno, capacidad, estado, linea_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
        [dto.placa.trim().toUpperCase(), dto.interno.trim(), dto.capacidad, dto.estado, dto.lineaId]
      );
      return rows[0];
    } catch (error) { return this.mapearError(error); }
  }

  async update(id: number, dto: UpdateMicroDto): Promise<Micro> {
    const actual = await this.findOne(id);
    const cambios = { ...actual, ...dto };
    await this.lineas.findOne(cambios.lineaId);
    try {
      const rows = await this.db.query<Micro>(
        `UPDATE micros SET placa = $1, interno = $2, capacidad = $3,
         estado = $4, linea_id = $5 WHERE id = $6 RETURNING ${COLUMNAS}`,
        [cambios.placa.trim().toUpperCase(), cambios.interno.trim(),
          cambios.capacidad, cambios.estado, cambios.lineaId, id]
      );
      if (!rows[0]) throw new NotFoundException('El micro no existe');
      return rows[0];
    } catch (error) { return this.mapearError(error); }
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      'DELETE FROM micros WHERE id = $1 RETURNING id', [id]
    );
    if (!rows[0]) throw new NotFoundException('El micro no existe');
  }
}
