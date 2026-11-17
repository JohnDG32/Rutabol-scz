import { Module } from '@nestjs/common';
import { LineasModule } from './lineas/lineas.module';
import { MicrosModule } from './micros/micros.module';

@Module({ imports: [LineasModule, MicrosModule] })
export class AppModule {}
