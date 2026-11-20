import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Linea } from './linea.interface';

@Injectable()
export class LineasService {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Promise<Linea[]> {
    return this.db.query<Linea>('SELECT id, nombre, zona, descripcion, color FROM lineas ORDER BY id');
  }

  async findOne(id: number): Promise<Linea> {
    const rows = await this.db.query<Linea>(
      'SELECT id, nombre, zona, descripcion, color FROM lineas WHERE id = $1', [id]
    );
    if (!rows[0]) throw new NotFoundException('La línea no existe');
    return rows[0];
  }
}
