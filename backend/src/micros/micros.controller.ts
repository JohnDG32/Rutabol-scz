import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { MicrosService } from './micros.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { SessionGuard } from '../auth/session.guard';

@Controller('micros')
export class MicrosController {
  constructor(private readonly service: MicrosService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @UseGuards(SessionGuard) create(@Body() dto: CreateMicroDto) { return this.service.create(dto); }
  @Patch(':id') @UseGuards(SessionGuard) update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMicroDto) { return this.service.update(id, dto); }
  @Delete(':id') @HttpCode(204) @UseGuards(SessionGuard) remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
