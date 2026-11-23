import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PagosService } from './pagos.service';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { ConfirmarStripeDto } from './dto/confirmar-stripe.dto';
import { Roles, TODOS_LOS_ROLES } from '../common/roles';
import { Pago } from './pago.interface';
import { StripeService } from './stripe.service';

type RawRequest = Request & { rawBody?: string | Buffer };

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly service: PagosService,
    private readonly stripe: StripeService,
  ) {}

  /** El frontend consulta esto para saber si muestra el botón de Stripe o el simulado. */
  @Get('config')
  configuracion(): { modo: 'SIMULADO' | 'STRIPE'; moneda: string } {
    return this.service.configuracion();
  }

  /** Webhook público: no lleva @Roles, pero exige la firma de Stripe. */
  @Post('webhook')
  webhook(@Req() req: RawRequest): { recibido: boolean } {
    const firma = req.headers['stripe-signature'];
    const evento = this.stripe.verificarWebhook(
      req.rawBody ?? '',
      Array.isArray(firma) ? firma[0] : firma
    );
    const sesionId = (evento.data.object as { id?: string }).id;
    if (sesionId && (evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.expired')) {
      this.service.aplicarWebhook(sesionId).catch(() => undefined);
    }
    return { recibido: true };
  }

  @Post() @Roles(...TODOS_LOS_ROLES)
  crear(@Body() dto: CrearPagoDto, @Req() req: Request): Promise<Pago> {
    return this.service.crear(dto, Number(req.session?.usuarioId));
  }

  @Get('mios') @Roles(...TODOS_LOS_ROLES)
  mios(@Req() req: Request): Promise<Pago[]> {
    return this.service.mios(Number(req.session?.usuarioId));
  }

  @Post(':id/checkout') @Roles(...TODOS_LOS_ROLES)
  checkout(@Param('id', ParseIntPipe) id: number): Promise<{ pagoId: number; sesionId: string; url: string }> {
    return this.service.crearSesion(id);
  }

  @Post(':id/confirmar-stripe') @Roles(...TODOS_LOS_ROLES)
  confirmarStripe(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmarStripeDto): Promise<Pago> {
    return this.service.confirmarStripe(id, dto.sessionId);
  }

  @Post(':id/confirmar') @Roles(...TODOS_LOS_ROLES)
  confirmar(@Param('id', ParseIntPipe) id: number): Promise<Pago> { return this.service.confirmar(id); }

  @Get(':id') @Roles(...TODOS_LOS_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Pago> { return this.service.findOne(id); }
}
