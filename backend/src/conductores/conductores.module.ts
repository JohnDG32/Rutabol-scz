import { Module } from '@nestjs/common';
import { MicrosModule } from '../micros/micros.module';
import { ConductoresController } from './conductores.controller';
import { ConductoresService } from './conductores.service';

@Module({
  imports: [MicrosModule],
  controllers: [ConductoresController],
  providers: [ConductoresService],
  exports: [ConductoresService],
})
export class ConductoresModule {}
