import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe = require('stripe');
import { Pago } from './pago.interface';

export type ModoPagos = 'SIMULADO' | 'STRIPE';

/**
 * Extra: adaptador de Stripe en modo de prueba.
 * Si no hay PAGOS_MODO=STRIPE y STRIPE_SECRET_KEY, la app sigue usando la pasarela simulada.
 */
@Injectable()
export class StripeService {
  readonly modo: ModoPagos;
  private readonly stripe: Stripe | null = null;
  private readonly moneda: string;
  private readonly tasa: number;
  private readonly exito: string;
  private readonly cancelacion: string;
  private readonly webhookSecret: string | null;

  constructor() {
    const clave = process.env.STRIPE_SECRET_KEY?.trim() || '';
    this.modo = process.env.PAGOS_MODO?.toUpperCase() === 'STRIPE' && clave ? 'STRIPE' : 'SIMULADO';
    this.moneda = (process.env.STRIPE_MONEDA || 'usd').toLowerCase();
    this.tasa = Number(process.env.STRIPE_TIPO_CAMBIO || '1') || 1;
    this.exito = process.env.STRIPE_SUCCESS_URL ||
      'https://www.rutabol.test/#pasajero?pago=stripe&session_id={CHECKOUT_SESSION_ID}';
    this.cancelacion = process.env.STRIPE_CANCEL_URL ||
      'https://www.rutabol.test/#pasajero?pago=cancelado';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;

    if (this.modo === 'STRIPE') {
      this.stripe = new Stripe(clave, { maxNetworkRetries: 1, timeout: 10000 });
      if (!/^sk_test_|^rk_test_/.test(clave)) {
        throw new Error('STRIPE_SECRET_KEY debe ser una clave de prueba (sk_test_...)');
      }
    }
  }

  configuracion(): { modo: ModoPagos; moneda: string } {
    return { modo: this.modo, moneda: this.moneda };
  }

  private cliente(): Stripe {
    if (!this.stripe) throw new BadRequestException('La pasarela Stripe no está configurada');
    return this.stripe;
  }

  /** Traduce errores de red/API en un mensaje claro sin exponer la clave secreta. */
  private async llamar<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'error desconocido';
      console.warn(`[Stripe] ${detalle}`);
      throw new BadRequestException(`Stripe rechazó la solicitud: ${detalle}`);
    }
  }

  /** Crea una Checkout Session; el pago se confirma al volver o por webhook. */
  async crearSesion(pago: Pago): Promise<{ url: string; sesionId: string }> {
    const sesion = await this.llamar(() => this.cliente().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: this.moneda,
          product_data: { name: `Pasaje Rutabol · ${pago.categoria}` },
          unit_amount: Math.round(Number(pago.monto) * this.tasa * 100),
        },
        quantity: 1,
      }],
      client_reference_id: String(pago.id),
      metadata: { pagoId: String(pago.id), referencia: pago.referencia },
      success_url: this.exito,
      cancel_url: this.cancelacion,
    }, { idempotencyKey: pago.referencia }));

    if (!sesion.url) throw new BadRequestException('Stripe no devolvió una URL de pago');
    return { url: sesion.url, sesionId: sesion.id };
  }

  /** Consulta el estado real en Stripe, sin depender de que el navegador vuelva. */
  async estadoDeSesion(sesionId: string): Promise<{
    estado: 'CONFIRMADO' | 'RECHAZADO' | 'PENDIENTE';
    pagoId: string | null;
  }> {
    const sesion = await this.llamar(() => this.cliente().checkout.sessions.retrieve(sesionId));
    const estado = sesion.payment_status === 'paid'
      ? 'CONFIRMADO'
      : sesion.status === 'expired' || (sesion.status === 'complete' && sesion.payment_status === 'unpaid')
        ? 'RECHAZADO'
        : 'PENDIENTE';
    return { estado, pagoId: sesion.client_reference_id };
  }

  validarSesion(sesionId: string, pago: Pago): void {
    if (!pago.stripeSesionId || pago.stripeSesionId !== sesionId) {
      throw new BadRequestException('La sesión de Stripe no corresponde a este pago');
    }
  }

  verificarWebhook(cuerpo: string | Buffer, firma: string | undefined): Stripe.Event {
    if (!this.webhookSecret || !firma) {
      throw new BadRequestException('Webhook de Stripe no configurado');
    }
    try {
      return this.cliente().webhooks.constructEvent(cuerpo, firma, this.webhookSecret);
    } catch {
      throw new BadRequestException('Firma de webhook inválida');
    }
  }
}
