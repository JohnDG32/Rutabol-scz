import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Linea } from './linea.interface';
import { CreateLineaDto } from './dto/create-linea.dto';
import { UpdateLineaDto } from './dto/update-linea.dto';

const COLUMNAS = 'id, nombre, zona, descripcion, color';

@Injectable()
export class LineasService {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Promise<Linea[]> {
    return this.db.query<Linea>(`SELECT ${COLUMNAS} FROM lineas ORDER BY id`);
  }

  async findOne(id: number): Promise<Linea> {
    const rows = await this.db.query<Linea>(`SELECT ${COLUMNAS} FROM lineas WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('La línea no existe');
    return rows[0];
  }

  async create(dto: CreateLineaDto): Promise<Linea> {
    try {
      const rows = await this.db.query<Linea>(
        `INSERT INTO lineas (nombre, zona, descripcion, color)
         VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
        [dto.nombre.trim(), dto.zona.trim(), dto.descripcion.trim(), dto.color]
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('El nombre de la línea ya existe');
      throw error;
    }
  }

  async update(id: number, dto: UpdateLineaDto): Promise<Linea> {
    const actual = await this.findOne(id);
    try {
      const rows = await this.db.query<Linea>(
        `UPDATE lineas SET nombre = $1, zona = $2, descripcion = $3, color = $4
         WHERE id = $5 RETURNING ${COLUMNAS}`,
        [dto.nombre ?? actual.nombre, dto.zona ?? actual.zona,
          dto.descripcion ?? actual.descripcion, dto.color ?? actual.color, id]
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('El nombre de la línea ya existe');
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM lineas WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('La línea no existe');
  }
}
