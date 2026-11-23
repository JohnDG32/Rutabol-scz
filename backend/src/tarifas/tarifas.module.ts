import { Module } from '@nestjs/common';
import { LineasModule } from '../lineas/lineas.module';
import { TarifasController } from './tarifas.controller';
import { TarifasService } from './tarifas.service';

@Module({
  imports: [LineasModule],
  controllers: [TarifasController],
  providers: [TarifasService],
  exports: [TarifasService],
})
export class TarifasModule {}
