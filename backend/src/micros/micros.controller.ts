import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseFloatPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { MicrosService } from './micros.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { PosicionDto } from './dto/posicion.dto';
import { Roles } from '../common/roles';
import { MicroCercano, Posicion } from './micro.interface';
import { Micro } from './micro.interface';

@Controller('micros')
export class MicrosController {
  constructor(private readonly service: MicrosService) {}

  @Get() findAll(): Promise<Micro[]> { return this.service.findAll(); }

  @Get('cercanos')
  cercanos(
    @Query('lat', new DefaultValuePipe(-17.7833), ParseFloatPipe) lat: number,
    @Query('lng', new DefaultValuePipe(-63.1821), ParseFloatPipe) lng: number,
    @Query('radio', new DefaultValuePipe(5), ParseFloatPipe) radio: number,
  ): Promise<MicroCercano[]> { return this.service.cercanos(lat, lng, radio); }

  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number): Promise<Micro> { return this.service.findOne(id); }

  @Post() @Roles('ADMIN')
  create(@Body() dto: CreateMicroDto): Promise<Micro> { return this.service.create(dto); }

  @Patch(':id') @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMicroDto): Promise<Micro> {
    return this.service.update(id, dto);
  }

  @Delete(':id') @HttpCode(204) @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> { return this.service.remove(id); }

  @Post(':id/posicion') @Roles('CONDUCTOR', 'ADMIN')
  posicion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PosicionDto,
  ): Promise<Posicion> { return this.service.registrarPosicion(id, dto.lat, dto.lng, dto.origen); }
}
