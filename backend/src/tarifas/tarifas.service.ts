import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LineasService } from '../lineas/lineas.service';
import { CategoriaTarifa } from '../common/roles';
import { CreateTarifaDto } from './dto/create-tarifa.dto';
import { UpdateTarifaDto } from './dto/update-tarifa.dto';
import { Tarifa } from './tarifa.interface';

const COLUMNAS = 'id, linea_id AS "lineaId", categoria, monto, vigente_desde AS "vigenteDesde", activa';

@Injectable()
export class TarifasService {
  constructor(private readonly db: DatabaseService, private readonly lineas: LineasService) {}

  async findAll(lineaId?: number, categoria?: CategoriaTarifa, incluirInactivas = false): Promise<Tarifa[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (lineaId !== undefined) { params.push(lineaId); condiciones.push('linea_id = $' + params.length); }
    if (categoria !== undefined) { params.push(categoria); condiciones.push('categoria = $' + params.length); }
    if (!incluirInactivas) condiciones.push('activa = TRUE');
    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
    return this.db.query<Tarifa>('SELECT ' + COLUMNAS + ' FROM tarifas ' + where + ' ORDER BY linea_id, categoria', params);
  }

  async findOne(id: number): Promise<Tarifa> {
    const rows = await this.db.query<Tarifa>('SELECT ' + COLUMNAS + ' FROM tarifas WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('La tarifa no existe');
    return rows[0];
  }

  /** RF-04/RN-02: tarifa autorizada vigente para una línea y categoría. */
  async tarifaVigente(lineaId: number, categoria: CategoriaTarifa): Promise<Tarifa> {
    const rows = await this.db.query<Tarifa>(
      'SELECT ' + COLUMNAS + ' FROM tarifas WHERE linea_id = $1 AND categoria = $2 AND activa = TRUE',
      [lineaId, categoria]
    );
    if (!rows[0]) throw new NotFoundException('No existe una tarifa autorizada para esa línea y categoría');
    return rows[0];
  }

  async create(dto: CreateTarifaDto): Promise<Tarifa> {
    await this.lineas.findOne(dto.lineaId);
    if (dto.activa !== false) {
      await this.db.query('UPDATE tarifas SET activa = FALSE WHERE linea_id = $1 AND categoria = $2', [dto.lineaId, dto.categoria]);
    }
    const rows = await this.db.query<Tarifa>(
      'INSERT INTO tarifas (linea_id, categoria, monto, activa) VALUES ($1, $2, $3, $4) RETURNING ' + COLUMNAS,
      [dto.lineaId, dto.categoria, dto.monto, dto.activa ?? true]
    );
    return rows[0];
  }

  async update(id: number, dto: UpdateTarifaDto): Promise<Tarifa> {
    const actual = await this.findOne(id);
    if (dto.activa === true) {
      await this.db.query('UPDATE tarifas SET activa = FALSE WHERE linea_id = $1 AND categoria = $2 AND id <> $3',
        [actual.lineaId, actual.categoria, id]);
    }
    const rows = await this.db.query<Tarifa>(
      'UPDATE tarifas SET monto = $1, activa = $2 WHERE id = $3 RETURNING ' + COLUMNAS,
      [dto.monto ?? actual.monto, dto.activa ?? actual.activa, id]
    );
    return rows[0];
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.query('UPDATE tarifas SET activa = FALSE WHERE id = $1', [id]);
  }
}
