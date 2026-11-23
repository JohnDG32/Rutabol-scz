import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LineasService } from '../lineas/lineas.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { Micro, MicroCercano, Posicion } from './micro.interface';

const COLUMNAS = `m.id, m.placa, m.interno, m.capacidad, m.estado, m.autorizado,
  m.linea_id AS "lineaId",
  COALESCE(COUNT(a.id) FILTER (WHERE a.estado = 'A BORDO'), 0)::int AS ocupacion`;

const DESDE = `FROM micros m
  LEFT JOIN viajes v ON v.micro_id = m.id AND v.estado = 'EN_CURSO'
  LEFT JOIN abordajes a ON a.viaje_id = v.id AND a.estado = 'A BORDO'`;

const RETORNO = `id, placa, interno, capacidad, estado, autorizado,
  linea_id AS "lineaId", 0 AS ocupacion`;

@Injectable()
export class MicrosService {
  constructor(private readonly db: DatabaseService, private readonly lineas: LineasService) {}

  findAll(): Promise<Micro[]> {
    return this.db.query<Micro>(`SELECT ${COLUMNAS} ${DESDE} GROUP BY m.id ORDER BY m.id`);
  }

  async findOne(id: number): Promise<Micro> {
    const rows = await this.db.query<Micro>(`SELECT ${COLUMNAS} ${DESDE} WHERE m.id = $1 GROUP BY m.id`, [id]);
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
        `INSERT INTO micros (placa, interno, capacidad, estado, autorizado, linea_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${RETORNO}`,
        [dto.placa.trim().toUpperCase(), dto.interno.trim(), dto.capacidad,
          dto.estado, dto.autorizado ?? false, dto.lineaId]
      );
      return rows[0];
    } catch (error) { return this.mapearError(error); }
  }

  async update(id: number, dto: UpdateMicroDto): Promise<Micro> {
    const actual = await this.findOne(id);
    const cambios = { ...actual, ...dto };
    await this.lineas.findOne(cambios.lineaId);
    try {
      await this.db.query(
        `UPDATE micros SET placa = $1, interno = $2, capacidad = $3,
          estado = $4, autorizado = $5, linea_id = $6 WHERE id = $7`,
        [cambios.placa.trim().toUpperCase(), cambios.interno.trim(),
          cambios.capacidad, cambios.estado, cambios.autorizado, cambios.lineaId, id]
      );
      return this.findOne(id);
    } catch (error) { return this.mapearError(error); }
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      'DELETE FROM micros WHERE id = $1 RETURNING id', [id]
    );
    if (!rows[0]) throw new NotFoundException('El micro no existe');
  }

  /** RF-06/RNF-16: guarda una posición GPS simulada y marca el micro en circulación. */
  async registrarPosicion(id: number, lat: number, lng: number): Promise<Posicion> {
    await this.findOne(id);
    await this.db.query(
      `UPDATE micros SET estado = CASE WHEN estado = 'DISPONIBLE' THEN 'EN_CIRCULACION' ELSE estado END
       WHERE id = $1`, [id]
    );
    const rows = await this.db.query<Posicion>(
      `INSERT INTO posiciones (micro_id, lat, lng) VALUES ($1, $2, $3)
       RETURNING id, micro_id AS "microId", lat, lng, registrado_en AS "registradoEn"`,
      [id, lat, lng]
    );
    return rows[0];
  }

  /** RF-07/RN-09: micros con posición reciente dentro del radio (5 km por defecto). */
  async cercanos(lat: number, lng: number, radio = 5): Promise<MicroCercano[]> {
    const rows = await this.db.query<MicroCercano>(
      `WITH ultimas AS (
         SELECT DISTINCT ON (p.micro_id) p.micro_id, p.lat, p.lng, p.registrado_en
         FROM posiciones p ORDER BY p.micro_id, p.registrado_en DESC
       )
       SELECT m.id, m.placa, m.interno, m.capacidad, m.estado, m.autorizado,
              m.linea_id AS "lineaId", 0 AS ocupacion,
              u.lat, u.lng, u.registrado_en AS "ultimaPosicion",
              6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians($1)) * cos(radians(u.lat)) * cos(radians(u.lng) - radians($2))
                + sin(radians($1)) * sin(radians(u.lat)))))) AS "distanciaKm"
       FROM micros m JOIN ultimas u ON u.micro_id = m.id
       WHERE m.estado <> 'FUERA_DE_SERVICIO'
       ORDER BY u.registrado_en DESC`,
      [lat, lng]
    );
    return rows
      .map((micro) => ({ ...micro, distanciaKm: Number(micro.distanciaKm) }))
      .filter((micro) => micro.distanciaKm <= radio)
      .sort((a, b) => a.distanciaKm - b.distanciaKm);
  }
}
