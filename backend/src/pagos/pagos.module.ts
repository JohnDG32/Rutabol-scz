import { Module } from '@nestjs/common';
import { EstudiantesModule } from '../estudiantes/estudiantes.module';
import { TarifasModule } from '../tarifas/tarifas.module';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

@Module({
  imports: [TarifasModule, EstudiantesModule],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}
