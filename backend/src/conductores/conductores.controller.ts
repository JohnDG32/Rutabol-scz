import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConductoresService } from './conductores.service';
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import { Roles } from '../common/roles';
import { Conductor } from './conductor.interface';

@Controller('conductores')
export class ConductoresController {
  constructor(private readonly service: ConductoresService) {}

  @Get() @Roles('ADMIN')
  findAll(): Promise<Conductor[]> { return this.service.findAll(); }

  @Get('yo') @Roles('CONDUCTOR')
  yo(@Req() req: Request): Promise<Conductor> {
    return this.service.obtenerPorUsuario(Number(req.session?.usuarioId));
  }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateConductorDto): Promise<Conductor> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateConductorDto): Promise<Conductor> {
    return this.service.update(id, dto);
  }

  @Delete(':id') @HttpCode(204) @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> { return this.service.remove(id); }
}
