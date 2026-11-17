import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LineasService } from './lineas.service';

@Controller('lineas')
export class LineasController {
  constructor(private readonly service: LineasService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
}
