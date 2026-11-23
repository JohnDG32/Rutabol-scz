import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PagosService } from './pagos.service';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { Roles, TODOS_LOS_ROLES } from '../common/roles';
import { Pago } from './pago.interface';

@Controller('pagos')
export class PagosController {
  constructor(private readonly service: PagosService) {}

  @Post() @Roles(...TODOS_LOS_ROLES)
  crear(@Body() dto: CrearPagoDto, @Req() req: Request): Promise<Pago> {
    return this.service.crear(dto, Number(req.session?.usuarioId));
  }

  @Get('mios') @Roles(...TODOS_LOS_ROLES)
  mios(@Req() req: Request): Promise<Pago[]> {
    return this.service.mios(Number(req.session?.usuarioId));
  }

  @Post(':id/confirmar') @Roles(...TODOS_LOS_ROLES)
  confirmar(@Param('id', ParseIntPipe) id: number): Promise<Pago> { return this.service.confirmar(id); }

  @Get(':id') @Roles(...TODOS_LOS_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Pago> { return this.service.findOne(id); }
}
