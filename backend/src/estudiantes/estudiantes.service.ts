import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';
import { ValidarEstudianteDto } from './dto/validar-estudiante.dto';
import { Estudiante } from './estudiante.interface';

const COLUMNAS = `id, usuario_id AS "usuarioId", nombre, apellido, ci, categoria, codigo,
  correo_institucional AS "correoInstitucional", foto_url AS "fotoUrl", verificado,
  creado_en AS "creadoEn"`;

@Injectable()
export class EstudiantesService {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Promise<Estudiante[]> {
    return this.db.query<Estudiante>(`SELECT ${COLUMNAS} FROM estudiantes ORDER BY id`);
  }

  async findOne(id: number): Promise<Estudiante> {
    const rows = await this.db.query<Estudiante>(`SELECT ${COLUMNAS} FROM estudiantes WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El estudiante no existe');
    return rows[0];
  }

  async porUsuario(usuarioId: number): Promise<Estudiante | null> {
    const rows = await this.db.query<Estudiante>(`SELECT ${COLUMNAS} FROM estudiantes WHERE usuario_id = $1`, [usuarioId]);
    return rows[0] ?? null;
  }

  private validarReglas(dto: CreateEstudianteDto): void {
    if (!dto.fotoUrl) throw new BadRequestException('La fotografía de identificación es obligatoria');
    if (dto.categoria === 'UNIVERSITARIO') {
      if (!dto.correoInstitucional || !/@upds\.edu\.bo$/i.test(dto.correoInstitucional.trim())) {
        throw new BadRequestException('El correo institucional debe terminar en @upds.edu.bo');
      }
    }
  }

  async create(dto: CreateEstudianteDto): Promise<Estudiante> {
    this.validarReglas(dto);
    try {
      const rows = await this.db.query<{ id: number }>(
        `INSERT INTO estudiantes
          (usuario_id, nombre, apellido, ci, categoria, codigo, correo_institucional, foto_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [dto.usuarioId ?? null, dto.nombre.trim(), dto.apellido.trim(), dto.ci.trim(),
          dto.categoria, dto.codigo.trim(), dto.correoInstitucional?.trim() || null, dto.fotoUrl]
      );
      return this.findOne(rows[0].id);
    } catch (error) {
      const codigo = (error as { code?: string })?.code;
      if (codigo === '23505') throw new ConflictException('La cédula, el usuario o el código ya están registrados');
      throw error;
    }
  }

  async update(id: number, dto: UpdateEstudianteDto): Promise<Estudiante> {
    const actual = await this.findOne(id);
    if (dto.correoInstitucional !== undefined && actual.categoria === 'UNIVERSITARIO' &&
        !/@upds\.edu\.bo$/i.test(dto.correoInstitucional.trim())) {
      throw new BadRequestException('El correo institucional debe terminar en @upds.edu.bo');
    }
    await this.db.query(
      `UPDATE estudiantes SET nombre = $1, apellido = $2, correo_institucional = $3,
        foto_url = $4, verificado = $5 WHERE id = $6`,
      [dto.nombre ?? actual.nombre, dto.apellido ?? actual.apellido,
        dto.correoInstitucional !== undefined ? dto.correoInstitucional.trim() || null : actual.correoInstitucional,
        dto.fotoUrl ?? actual.fotoUrl, dto.verificado ?? actual.verificado, id]
    );
    return this.findOne(id);
  }

  async verificar(id: number): Promise<Estudiante> {
    await this.findOne(id);
    return this.update(id, { verificado: true });
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM estudiantes WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('El estudiante no existe');
  }

  /** RF-13/RF-14/RF-16/RN-07/RN-08: validación de código, categoría y fotografía. */
  async validar(dto: ValidarEstudianteDto): Promise<{ valido: true; estudiante: Estudiante }> {
    const rows = await this.db.query<Estudiante>(
      `SELECT ${COLUMNAS} FROM estudiantes WHERE categoria = $1 AND codigo = $2`,
      [dto.categoria, dto.codigo.trim()]
    );
    const estudiante = rows[0];
    if (!estudiante) throw new NotFoundException('No existe un estudiante con ese código y categoría');
    if (!estudiante.verificado) throw new BadRequestException('El estudiante todavía no fue verificado');
    if (dto.fotoUrl && dto.fotoUrl.trim() !== estudiante.fotoUrl.trim()) {
      throw new UnauthorizedException('La fotografía no coincide con la registrada');
    }
    return { valido: true, estudiante };
  }
}
