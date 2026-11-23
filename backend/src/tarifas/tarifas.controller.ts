import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { TarifasService } from './tarifas.service';
import { CreateTarifaDto } from './dto/create-tarifa.dto';
import { UpdateTarifaDto } from './dto/update-tarifa.dto';
import { Roles, CategoriaTarifa } from '../common/roles';
import { Tarifa } from './tarifa.interface';

@Controller('tarifas')
export class TarifasController {
  constructor(private readonly service: TarifasService) {}

  @Get()
  findAll(
    @Query('lineaId', new DefaultValuePipe(0), ParseIntPipe) lineaId: number,
    @Query('categoria') categoria?: CategoriaTarifa,
  ): Promise<Tarifa[]> {
    const categoriaValida: CategoriaTarifa | undefined =
      categoria === 'GENERAL' || categoria === 'ESCOLAR' || categoria === 'UNIVERSITARIO' ? categoria : undefined;
    return this.service.findAll(lineaId || undefined, categoriaValida);
  }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateTarifaDto): Promise<Tarifa> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTarifaDto): Promise<Tarifa> {
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> { return this.service.remove(id); }
}
