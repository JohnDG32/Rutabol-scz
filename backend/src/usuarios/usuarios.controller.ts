import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/roles';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioGestion } from './usuario.interface';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get() @Roles('ADMIN')
  findAll(): Promise<UsuarioGestion[]> { return this.service.findAll(); }

  @Get(':id') @Roles('ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UsuarioGestion> { return this.service.findOne(id); }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateUsuarioDto): Promise<UsuarioGestion> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto): Promise<UsuarioGestion> {
    return this.service.update(id, dto, Number(req.session?.usuarioId));
  }

  @Delete(':id') @HttpCode(204) @Roles('ADMIN')
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.desactivar(id, Number(req.session?.usuarioId));
  }
}
