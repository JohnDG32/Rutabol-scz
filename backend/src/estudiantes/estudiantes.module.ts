import { Module } from '@nestjs/common';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesService } from './estudiantes.service';
import { FotoService } from './foto.service';

@Module({
  controllers: [EstudiantesController],
  providers: [EstudiantesService, FotoService],
  exports: [EstudiantesService, FotoService],
})
export class EstudiantesModule {}
