import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ViajesService } from './viajes.service';
import { IniciarViajeDto } from './dto/iniciar-viaje.dto';
import { AbordarDto } from './dto/abordar.dto';
import { BajarDto } from './dto/bajar.dto';
import { TrasbordoDto, EmergenciaDto } from './dto/trasbordo.dto';
import { Roles, TODOS_LOS_ROLES } from '../common/roles';
import { Abordaje, Historial, ResultadoTrasbordo, Viaje } from './viaje.interface';

@Controller('viajes')
export class ViajesController {
  constructor(private readonly service: ViajesService) {}

  @Get('activos') @Roles('ADMIN', 'CONDUCTOR')
  activos(): Promise<Viaje[]> { return this.service.activos(); }

  @Get('historial') @Roles(...TODOS_LOS_ROLES)
  historial(@Req() req: Request): Promise<Historial> {
    return this.service.historial(Number(req.session?.usuarioId));
  }

  @Get(':id') @Roles(...TODOS_LOS_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Viaje> { return this.service.findOne(id); }

  @Post() @Roles('CONDUCTOR', 'ADMIN')
  iniciar(@Body() dto: IniciarViajeDto, @Req() req: Request): Promise<Viaje> {
    return this.service.iniciar(dto, Number(req.session?.usuarioId));
  }

  @Post(':id/abordar') @Roles('CONDUCTOR', 'ADMIN')
  abordar(@Param('id', ParseIntPipe) id: number, @Body() dto: AbordarDto) {
    return this.service.abordar(id, dto);
  }

  @Post(':id/bajar') @Roles('CONDUCTOR', 'ADMIN')
  bajar(@Param('id', ParseIntPipe) id: number, @Body() dto: BajarDto): Promise<Abordaje> {
    return this.service.bajar(id, dto);
  }

  @Post(':id/finalizar') @Roles('CONDUCTOR', 'ADMIN')
  finalizar(@Param('id', ParseIntPipe) id: number): Promise<Viaje> { return this.service.finalizar(id); }

  @Post(':id/trasbordo') @Roles('CONDUCTOR', 'ADMIN')
  trasbordo(@Param('id', ParseIntPipe) id: number, @Body() dto: TrasbordoDto): Promise<ResultadoTrasbordo> {
    return this.service.trasbordo(id, dto);
  }

  @Post(':id/emergencia') @Roles('CONDUCTOR', 'ADMIN')
  emergencia(@Param('id', ParseIntPipe) id: number, @Body() dto: EmergenciaDto): Promise<ResultadoTrasbordo> {
    return this.service.emergencia(id, dto);
  }
}
