import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { TarifasService } from '../tarifas/tarifas.service';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { CategoriaTarifa } from '../common/roles';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { Pago } from './pago.interface';
import { StripeService } from './stripe.service';

const COLUMNAS = `id, usuario_id AS "usuarioId", viaje_id AS "viajeId", monto, categoria,
  metodo, estado, referencia, stripe_sesion_id AS "stripeSesionId",
  creado_en AS "creadoEn", confirmado_en AS "confirmadoEn"`;

@Injectable()
export class PagosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tarifas: TarifasService,
    private readonly estudiantes: EstudiantesService,
    private readonly stripe: StripeService,
  ) {}

  configuracion(): { modo: 'SIMULADO' | 'STRIPE'; moneda: string } {
    return this.stripe.configuracion();
  }

  async findOne(id: number): Promise<Pago> {
    const rows = await this.db.query<Pago>(`SELECT ${COLUMNAS} FROM pagos WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El pago no existe');
    return rows[0];
  }

  async porSesion(sesionId: string): Promise<Pago | null> {
    const rows = await this.db.query<Pago>(`SELECT ${COLUMNAS} FROM pagos WHERE stripe_sesion_id = $1`, [sesionId]);
    return rows[0] ?? null;
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
    const esStripe = this.stripe.modo === 'STRIPE';
    const referencia = `${esStripe ? 'STR' : 'SIM'}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const rows = await this.db.query<Pago>(
      `INSERT INTO pagos (usuario_id, viaje_id, monto, categoria, metodo, estado, referencia)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6) RETURNING ${COLUMNAS}`,
      [usuarioId, dto.viajeId, tarifa.monto, dto.categoria, esStripe ? 'STRIPE' : 'SIMULADO', referencia]
    );
    return rows[0];
  }

  /** Extra: crea la sesión alojada de Stripe y guarda su id para poder verificarla después. */
  async crearSesion(id: number): Promise<{ pagoId: number; sesionId: string; url: string }> {
    const pago = await this.findOne(id);
    if (pago.metodo !== 'STRIPE') {
      throw new BadRequestException('Este pago usa la pasarela simulada; no tiene sesión de Stripe');
    }
    if (pago.estado !== 'PENDIENTE') throw new BadRequestException('El pago ya no está pendiente');

    const sesion = await this.stripe.crearSesion(pago);
    await this.db.query('UPDATE pagos SET stripe_sesion_id = $1 WHERE id = $2', [sesion.sesionId, id]);
    return { pagoId: id, ...sesion };
  }

  /** Extra: confirma (o rechaza) consultando el estado real de la sesión en Stripe. */
  async confirmarStripe(id: number, sesionId: string): Promise<Pago> {
    const pago = await this.findOne(id);
    this.stripe.validarSesion(sesionId, pago);
    const resultado = await this.stripe.estadoDeSesion(sesionId);
    if (resultado.pagoId && resultado.pagoId !== String(id)) {
      throw new BadRequestException('La sesión de Stripe pertenece a otro pago');
    }
    if (resultado.estado === 'PENDIENTE') throw new BadRequestException('Stripe todavía no confirmó el pago');
    return this.marcar(id, resultado.estado);
  }

  /** Extra: confirma desde el webhook firmado, sin esperar el retorno del navegador. */
  async aplicarWebhook(sesionId: string): Promise<Pago | null> {
    const pago = await this.porSesion(sesionId);
    if (!pago) return null;
    const { estado } = await this.stripe.estadoDeSesion(sesionId);
    if (estado === 'PENDIENTE' || pago.estado === estado) return pago;
    return this.marcar(pago.id, estado);
  }

  /** RF-18/RN-11: simulación de la confirmación devuelta por la pasarela. */
  async confirmar(id: number): Promise<Pago> {
    const pago = await this.findOne(id);
    if (pago.metodo === 'STRIPE') {
      throw new BadRequestException('Los pagos de Stripe se confirman al volver de la pasarela');
    }
    if (pago.estado === 'CONFIRMADO') return pago;
    if (pago.estado === 'RECHAZADO') throw new BadRequestException('La pasarela rechazó este pago');
    return this.marcar(id, 'CONFIRMADO');
  }

  private async marcar(id: number, estado: 'CONFIRMADO' | 'RECHAZADO'): Promise<Pago> {
    const sql = estado === 'CONFIRMADO'
      ? `UPDATE pagos SET estado = 'CONFIRMADO', confirmado_en = now() WHERE id = $1 RETURNING ${COLUMNAS}`
      : `UPDATE pagos SET estado = 'RECHAZADO', confirmado_en = NULL WHERE id = $1 RETURNING ${COLUMNAS}`;
    const rows = await this.db.query<Pago>(sql, [id]);
    return rows[0];
  }
}
