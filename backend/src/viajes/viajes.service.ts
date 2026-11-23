import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MicrosService } from '../micros/micros.service';
import { ConductoresService } from '../conductores/conductores.service';
import { PagosService } from '../pagos/pagos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TarifasService } from '../tarifas/tarifas.service';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { IniciarViajeDto } from './dto/iniciar-viaje.dto';
import { AbordarDto } from './dto/abordar.dto';
import { BajarDto } from './dto/bajar.dto';
import { TrasbordoDto, EmergenciaDto } from './dto/trasbordo.dto';
import { Abordaje, Historial, ResultadoTrasbordo, Trasbordo, Viaje } from './viaje.interface';

const COLUMNAS = `v.id, v.micro_id AS "microId", v.conductor_id AS "conductorId",
  v.linea_id AS "lineaId", v.tipo, v.estado, v.iniciado_en AS "iniciadoEn",
  v.finalizado_en AS "finalizadoEn", m.placa, m.interno, m.capacidad,
  l.nombre AS "lineaNombre",
  COALESCE(COUNT(a.id) FILTER (WHERE a.estado = 'A BORDO'), 0)::int AS ocupacion`;

const DESDE = `FROM viajes v
  JOIN micros m ON m.id = v.micro_id
  JOIN lineas l ON l.id = v.linea_id
  LEFT JOIN abordajes a ON a.viaje_id = v.id AND a.estado = 'A BORDO'`;

@Injectable()
export class ViajesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly micros: MicrosService,
    private readonly conductores: ConductoresService,
    private readonly pagos: PagosService,
    private readonly notificaciones: NotificacionesService,
    private readonly tarifas: TarifasService,
    private readonly estudiantes: EstudiantesService,
  ) {}

  async findOne(id: number): Promise<Viaje> {
    const rows = await this.db.query<Viaje>(`SELECT ${COLUMNAS} ${DESDE} WHERE v.id = $1 GROUP BY v.id, m.id, l.id`, [id]);
    if (!rows[0]) throw new NotFoundException('El viaje no existe');
    return rows[0];
  }

  activos(): Promise<Viaje[]> {
    return this.db.query<Viaje>(
      `SELECT ${COLUMNAS} ${DESDE} WHERE v.estado = 'EN_CURSO' GROUP BY v.id, m.id, l.id ORDER BY v.id`
    );
  }

  /** RF-21: historial de viajes, pagos, trasbordos y micros de un pasajero. */
  async historial(usuarioId: number): Promise<Historial> {
    const viajes = await this.db.query<Viaje>(
      `SELECT ${COLUMNAS} ${DESDE}
       WHERE EXISTS (SELECT 1 FROM abordajes ab WHERE ab.viaje_id = v.id AND ab.usuario_id = $1)
          OR EXISTS (SELECT 1 FROM pagos p WHERE p.viaje_id = v.id AND p.usuario_id = $1)
       GROUP BY v.id, m.id, l.id ORDER BY v.iniciado_en DESC`, [usuarioId]
    );
    const trasbordos = await this.db.query<Trasbordo>(
      `SELECT id, viaje_origen_id AS "viajeOrigenId", viaje_destino_id AS "viajeDestinoId",
        abordaje_id AS "abordajeId", usuario_id AS "usuarioId", tipo, motivo,
        pago_reutilizado AS "pagoReutilizado", creado_en AS "creadoEn"
       FROM trasbordos WHERE usuario_id = $1 ORDER BY id DESC`, [usuarioId]
    );
    const abordajes = await this.db.query<Abordaje>(
      `SELECT id, viaje_id AS "viajeId", usuario_id AS "usuarioId", categoria,
        pago_id AS "pagoId", estado, registrado_en AS "registradoEn"
       FROM abordajes WHERE usuario_id = $1 ORDER BY id DESC`, [usuarioId]
    );
    return { viajes, pagos: await this.pagos.mios(usuarioId), trasbordos, abordajes };
  }

  /** RN-01/RN-02: solo un micro registrado, autorizado y disponible puede operar. */
  async iniciar(dto: IniciarViajeDto, usuarioId: number): Promise<Viaje> {
    const conductor = await this.conductores.obtenerPorUsuario(usuarioId);
    if (!conductor.activo) throw new BadRequestException('El conductor está inactivo');

    const micro = await this.micros.findOne(dto.microId);
    if (!micro.autorizado) throw new BadRequestException('El micro no está registrado y autorizado para operar');
    if (micro.estado === 'FUERA_DE_SERVICIO' || micro.estado === 'EMERGENCIA' || micro.estado === 'LLENO') {
      throw new BadRequestException('El micro no se encuentra disponible');
    }

    const microOcupado = await this.db.query<{ id: number }>(
      "SELECT id FROM viajes WHERE micro_id = $1 AND estado = 'EN_CURSO'", [micro.id]
    );
    if (microOcupado.length) throw new ConflictException('El micro ya tiene un viaje en curso');
    const conductorOcupado = await this.db.query<{ id: number }>(
      "SELECT id FROM viajes WHERE conductor_id = $1 AND estado = 'EN_CURSO'", [conductor.id]
    );
    if (conductorOcupado.length) throw new ConflictException('El conductor ya tiene un viaje en curso');

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO viajes (micro_id, conductor_id, linea_id, tipo)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [micro.id, conductor.id, micro.lineaId, dto.tipo ?? 'NORMAL']
    );
    await this.db.query("UPDATE micros SET estado = 'EN_CIRCULACION' WHERE id = $1", [micro.id]);
    return this.findOne(rows[0].id);
  }

  /** RF-08/RF-09/RF-10/RN-04/RN-05/RN-06/RN-11: abordaje con pago válido y cupo. */
  async abordar(viajeId: number, dto: AbordarDto): Promise<{ abordaje: Abordaje; ocupacion: number; capacidad: number }> {
    const viaje = await this.findOne(viajeId);
    if (viaje.estado !== 'EN_CURSO') throw new BadRequestException('El viaje no está en curso');

    const micro = await this.micros.findOne(viaje.microId);
    const pago = await this.pagos.findOne(dto.pagoId);
    if (pago.estado !== 'CONFIRMADO') throw new BadRequestException('El pago no fue confirmado por la pasarela');
    if (pago.viajeId !== viajeId && !dto.esTrasbordo) {
      throw new BadRequestException('El pago pertenece a otro viaje; registre el trasbordo correspondiente');
    }
    if (dto.esTrasbordo) {
      const anteriores = await this.db.query<{ id: number }>(
        'SELECT id FROM abordajes WHERE pago_id = $1 AND viaje_id <> $2 LIMIT 1', [pago.id, viajeId]
      );
      if (!anteriores.length) throw new BadRequestException('No existe un abordaje previo para este trasbordo');
    }

    const tarifa = await this.tarifas.tarifaVigente(viaje.lineaId, dto.categoria);
    if (Number(pago.monto) !== Number(tarifa.monto)) {
      throw new BadRequestException('El monto pagado no coincide con la tarifa autorizada');
    }
    if (dto.categoria !== 'GENERAL') {
      if (!pago.usuarioId) throw new BadRequestException('El pago no está asociado a un estudiante');
      const estudiante = await this.estudiantes.porUsuario(pago.usuarioId);
      if (!estudiante?.verificado) throw new BadRequestException('La condición de estudiante no está verificada');
    }

    const conteo = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM abordajes WHERE viaje_id = $1 AND estado = 'A BORDO'", [viajeId]
    );
    const ocupacion = conteo[0].total;
    if (ocupacion >= micro.capacidad) {
      await this.db.query("UPDATE micros SET estado = 'LLENO' WHERE id = $1", [micro.id]);
      await this.notificaciones.crear('CONDUCTOR', 'CAPACIDAD',
        `El micro ${micro.interno} alcanzó su capacidad máxima de ${micro.capacidad} pasajeros`);
      await this.notificaciones.crear('ADMIN', 'CAPACIDAD',
        `Alerta de capacidad en el micro ${micro.interno} (${ocupacion}/${micro.capacidad})`);
      throw new ConflictException('Capacidad máxima alcanzada: no se permiten nuevos abordajes');
    }

    const rows = await this.db.query<Abordaje>(
      `INSERT INTO abordajes (viaje_id, usuario_id, categoria, pago_id, estado)
       VALUES ($1, $2, $3, $4, 'A BORDO')
       RETURNING id, viaje_id AS "viajeId", usuario_id AS "usuarioId", categoria,
                 pago_id AS "pagoId", estado, registrado_en AS "registradoEn"`,
      [viajeId, pago.usuarioId, dto.categoria, pago.id]
    );
    return { abordaje: rows[0], ocupacion: ocupacion + 1, capacidad: micro.capacidad };
  }

  async bajar(viajeId: number, dto: BajarDto): Promise<Abordaje> {
    await this.findOne(viajeId);
    const abordajes = await this.db.query<Abordaje>(
      "SELECT * FROM abordajes WHERE id = $1 AND viaje_id = $2 AND estado = 'A BORDO'",
      [dto.abordajeId, viajeId]
    );
    if (!abordajes[0]) throw new NotFoundException('El abordaje no existe o el pasajero ya bajó');
    const viaje = await this.findOne(viajeId);
    const rows = await this.db.query<Abordaje>(
      `UPDATE abordajes SET estado = 'BAJADO' WHERE id = $1
       RETURNING id, viaje_id AS "viajeId", usuario_id AS "usuarioId", categoria,
                 pago_id AS "pagoId", estado, registrado_en AS "registradoEn"`,
      [dto.abordajeId]
    );
    await this.db.query("UPDATE micros SET estado = 'EN_CIRCULACION' WHERE id = $1 AND estado = 'LLENO'", [viaje.microId]);
    return rows[0];
  }

  async finalizar(viajeId: number): Promise<Viaje> {
    const viaje = await this.findOne(viajeId);
    if (viaje.estado !== 'EN_CURSO') return viaje;
    await this.db.query(
      "UPDATE viajes SET estado = 'FINALIZADO', finalizado_en = now() WHERE id = $1", [viajeId]
    );
    await this.db.query("UPDATE abordajes SET estado = 'BAJADO' WHERE viaje_id = $1 AND estado = 'A BORDO'", [viajeId]);
    await this.db.query("UPDATE micros SET estado = 'DISPONIBLE' WHERE id = $1", [viaje.microId]);
    return this.findOne(viajeId);
  }

  private async crearViajeDestino(
    origen: Viaje,
    microDestinoId: number,
    tipo: 'NORMAL' | 'EMERGENCIA',
  ): Promise<Viaje> {
    const destino = await this.micros.findOne(microDestinoId);
    if (!destino.autorizado) throw new BadRequestException('El micro destino no está autorizado');
    if (destino.lineaId !== origen.lineaId) throw new BadRequestException('El trasbordo debe ser entre micros de la misma línea');
    if (['FUERA_DE_SERVICIO', 'EMERGENCIA', 'LLENO'].includes(destino.estado)) {
      throw new BadRequestException('El micro destino no se encuentra disponible');
    }
    const ocupado = await this.db.query<{ id: number }>(
      "SELECT id FROM viajes WHERE micro_id = $1 AND estado = 'EN_CURSO'", [destino.id]
    );
    if (ocupado.length) throw new ConflictException('El micro destino ya tiene un viaje en curso');

    const fila = await this.db.query<{ id: number }>(
      'INSERT INTO viajes (micro_id, conductor_id, linea_id, tipo) VALUES ($1, $2, $3, $4) RETURNING id',
      [destino.id, origen.conductorId, origen.lineaId, tipo]
    );
    await this.db.query("UPDATE micros SET estado = 'EN_CIRCULACION' WHERE id = $1", [destino.id]);
    return this.findOne(fila[0].id);
  }

  /** RF-11/RF-12/RN-05/RN-06: reutiliza el pago, no cobra dos veces. */
  async trasbordo(viajeId: number, dto: TrasbordoDto, tipo: 'NORMAL' | 'EMERGENCIA' = 'NORMAL', motivo?: string): Promise<ResultadoTrasbordo> {
    const origen = await this.findOne(viajeId);
    if (origen.estado !== 'EN_CURSO') throw new BadRequestException('El viaje de origen no está en curso');

    // Validar todo antes de crear el viaje destino para no dejar registros huérfanos.
    const validados: Array<{ anterior: Abordaje; pagoId: number }> = [];
    for (const abordajeId of dto.abordajeIds) {
      const anteriores = await this.db.query<Abordaje>(
        "SELECT * FROM abordajes WHERE id = $1 AND viaje_id = $2 AND estado = 'A BORDO'",
        [abordajeId, viajeId]
      );
      const anterior = anteriores[0];
      if (!anterior) throw new BadRequestException(`El abordaje ${abordajeId} no está activo en el viaje de origen`);
      const pago = await this.pagos.findOne(anterior.pagoId);
      if (pago.estado !== 'CONFIRMADO') throw new BadRequestException('El pago del pasajero no está confirmado');
      validados.push({ anterior, pagoId: pago.id });
    }

    const viajeDestino = await this.crearViajeDestino(origen, dto.microDestinoId, tipo);
    const resultados: Trasbordo[] = [];

    for (const { anterior, pagoId } of validados) {
      await this.db.query("UPDATE abordajes SET estado = 'BAJADO' WHERE id = $1", [anterior.id]);
      const nuevo = await this.db.query<Abordaje>(
        `INSERT INTO abordajes (viaje_id, usuario_id, categoria, pago_id, estado)
         VALUES ($1, $2, $3, $4, 'A BORDO')
         RETURNING id, viaje_id AS "viajeId", usuario_id AS "usuarioId", categoria,
                   pago_id AS "pagoId", estado, registrado_en AS "registradoEn"`,
        [viajeDestino.id, anterior.usuarioId, anterior.categoria, pagoId]
      );
      const traslado = await this.db.query<Trasbordo>(
        `INSERT INTO trasbordos
          (viaje_origen_id, viaje_destino_id, abordaje_id, usuario_id, tipo, motivo, pago_reutilizado)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, viaje_origen_id AS "viajeOrigenId", viaje_destino_id AS "viajeDestinoId",
                   abordaje_id AS "abordajeId", usuario_id AS "usuarioId", tipo, motivo,
                   pago_reutilizado AS "pagoReutilizado", creado_en AS "creadoEn"`,
        [origen.id, viajeDestino.id, nuevo[0].id, anterior.usuarioId, tipo, motivo ?? null]
      );
      resultados.push(traslado[0]);
    }
    return { viajeDestino, trasbordos: resultados };
  }

  /** RF-19/RF-20/RN-10: trasbordo por falla mecánica o emergencia del conductor. */
  async emergencia(viajeId: number, dto: EmergenciaDto): Promise<ResultadoTrasbordo> {
    const origen = await this.findOne(viajeId);
    const resultado = await this.trasbordo(viajeId, dto, 'EMERGENCIA', dto.motivo);
    await this.db.query("UPDATE micros SET estado = 'EMERGENCIA' WHERE id = $1", [origen.microId]);
    await this.db.query(
      "UPDATE viajes SET estado = 'FINALIZADO', finalizado_en = now() WHERE id = $1", [origen.id]
    );
    await this.notificaciones.crear('PASAJEROS', 'EMERGENCIA',
      `Emergencia en el micro ${origen.interno}. Trasbordo autorizado al micro ${resultado.viajeDestino.interno}. Motivo: ${dto.motivo}`);
    await this.notificaciones.crear('ADMIN', 'EMERGENCIA',
      `Se registró una emergencia en la línea ${origen.lineaNombre}. Micro ${origen.interno} fuera de circulación.`);
    return { ...resultado, notificaciones: 2 };
  }
}
