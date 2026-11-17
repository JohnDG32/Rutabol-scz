import { Injectable, NotFoundException } from '@nestjs/common';
import { Linea } from './linea.interface';

@Injectable()
export class LineasService {
  private readonly lineas: Linea[] = [
    { id: 1, nombre: 'Línea 47 Norte', zona: 'Zona norte', descripcion: 'Micro Chevere', color: '#0f766e' },
    { id: 2, nombre: 'Línea 55 Centro', zona: 'Zona central', descripcion: 'Siempre en servicio', color: '#2563eb' },
    { id: 3, nombre: 'Línea 10 Sur', zona: 'Zona sur', descripcion: 'Voy a la Zona roja de la ciudad', color: '#c2410c' },
    { id: 4, nombre: 'Línea 40 Este', zona: 'Zona este', descripcion: 'Viva la lujan', color: '#7c3aed' },
  ];

  findAll(): Linea[] { return this.lineas; }
  findOne(id: number): Linea {
    const linea = this.lineas.find((item) => item.id === id);
    if (!linea) throw new NotFoundException('La línea no existe');
    return linea;
  }
}
