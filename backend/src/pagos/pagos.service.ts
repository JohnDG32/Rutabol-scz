import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { TarifasService } from '../tarifas/tarifas.service';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { CategoriaTarifa } from '../common/roles';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { Pago } from './pago.interface';

const COLUMNAS = `id, usuario_id AS "usuarioId", viaje_id AS "viajeId", monto, categoria,
  metodo, estado, referencia, creado_en AS "creadoEn", confirmado_en AS "confirmadoEn"`;

@Injectable()
export class PagosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tarifas: TarifasService,
    private readonly estudiantes: EstudiantesService,
  ) {}

  async findOne(id: number): Promise<Pago> {
    const rows = await this.db.query<Pago>(`SELECT ${COLUMNAS} FROM pagos WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El pago no existe');
    return rows[0];
  }

  mios(usuarioId: number): Promise<Pago[]> {
    return this.db.query<Pago>(`SELECT ${COLUMNAS} FROM pagos WHERE usuario_id = $1 ORDER BY id DESC LIMIT 100`, [usuarioId]);
  }

  /** RF-04/RF-17/RN-02/RN-11: la tarifa la fija el sistema, nunca el conductor. */
  async crear(dto: CrearPagoDto, usuarioId: number): Promise<Pago> {
    const viajes = await this.db.query<{ id: number; linea_id: number; estado: string }>(
      'SELECT id, linea_id, estado FROM viajes WHERE id = $1', [dto.viajeId]
    );
    const viaje = viajes[0];
    if (!viaje) throw new NotFoundException('El viaje no existe');
    if (viaje.estado !== 'EN_CURSO') throw new BadRequestException('El viaje ya no está en curso');

    if (dto.categoria !== 'GENERAL') {
      const estudiante = await this.estudiantes.porUsuario(usuarioId);
      if (!estudiante) throw new BadRequestException('Su usuario no está registrado como estudiante');
      if (!estudiante.verificado) throw new BadRequestException('Debe verificar su condición de estudiante');
      if ((dto.categoria === 'ESCOLAR' && estudiante.categoria !== 'ESCOLAR') ||
          (dto.categoria === 'UNIVERSITARIO' && estudiante.categoria !== 'UNIVERSITARIO')) {
        throw new BadRequestException('La categoría del pago no coincide con su categoría de estudiante');
      }
    }

    const tarifa = await this.tarifas.tarifaVigente(viaje.linea_id, dto.categoria as CategoriaTarifa);
    const referencia = `SIM-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const rows = await this.db.query<Pago>(
      `INSERT INTO pagos (usuario_id, viaje_id, monto, categoria, metodo, estado, referencia)
       VALUES ($1, $2, $3, $4, 'SIMULADO', 'PENDIENTE', $5) RETURNING ${COLUMNAS}`,
      [usuarioId, dto.viajeId, tarifa.monto, dto.categoria, referencia]
    );
    return rows[0];
  }

  /** RF-18/RN-11: simulación de la confirmación devuelta por la pasarela. */
  async confirmar(id: number): Promise<Pago> {
    const pago = await this.findOne(id);
    if (pago.estado === 'CONFIRMADO') return pago;
    if (pago.estado === 'RECHAZADO') throw new BadRequestException('La pasarela rechazó este pago');
    const rows = await this.db.query<Pago>(
      `UPDATE pagos SET estado = 'CONFIRMADO', confirmado_en = now()
       WHERE id = $1 RETURNING ${COLUMNAS}`, [id]
    );
    return rows[0];
  }
}
