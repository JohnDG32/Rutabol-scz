import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EstudiantesService } from './estudiantes.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';
import { ValidarEstudianteDto } from './dto/validar-estudiante.dto';
import { Roles } from '../common/roles';
import { Estudiante } from './estudiante.interface';

@Controller('estudiantes')
export class EstudiantesController {
  constructor(private readonly service: EstudiantesService) {}

  @Get() @Roles('ADMIN')
  findAll(): Promise<Estudiante[]> { return this.service.findAll(); }

  @Get('yo') @Roles('ESTUDIANTE')
  yo(@Req() req: Request): Promise<Estudiante | null> {
    return this.service.porUsuario(Number(req.session?.usuarioId));
  }

  @Post('validar') @Roles('CONDUCTOR', 'ADMIN')
  validar(@Body() dto: ValidarEstudianteDto) { return this.service.validar(dto); }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateEstudianteDto): Promise<Estudiante> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEstudianteDto): Promise<Estudiante> {
    return this.service.update(id, dto);
  }

  @Post(':id/verificar') @Roles('ADMIN')
  verificar(@Param('id', ParseIntPipe) id: number): Promise<Estudiante> { return this.service.verificar(id); }

  @Delete(':id') @HttpCode(204) @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> { return this.service.remove(id); }
}
