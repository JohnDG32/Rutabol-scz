import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { LineasService } from './lineas.service';
import { CreateLineaDto } from './dto/create-linea.dto';
import { UpdateLineaDto } from './dto/update-linea.dto';
import { Roles } from '../common/roles';
import { Linea } from './linea.interface';

@Controller('lineas')
export class LineasController {
  constructor(private readonly service: LineasService) {}

  @Get() findAll(): Promise<Linea[]> { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number): Promise<Linea> { return this.service.findOne(id); }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateLineaDto): Promise<Linea> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLineaDto): Promise<Linea> {
    return this.service.update(id, dto);
  }

  @Delete(':id') @HttpCode(204) @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> { return this.service.remove(id); }
}
