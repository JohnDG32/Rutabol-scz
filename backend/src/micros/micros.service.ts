import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LineasService } from '../lineas/lineas.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { Micro } from './micro.interface';

@Injectable()
export class MicrosService {
  private micros: Micro[] = [
    { id: 1, placa: 'SCZ-001', interno: '101', capacidad: 32, estado: 'ACTIVO', lineaId: 1 },
    { id: 2, placa: 'SCZ-002', interno: '202', capacidad: 38, estado: 'MANTENIMIENTO', lineaId: 2 },
    { id: 3, placa: 'SCZ-003', interno: '303', capacidad: 30, estado: 'ACTIVO', lineaId: 3 },
  ];
  private nextId = 4;

  constructor(private readonly lineas: LineasService) {}

  findAll(): Micro[] { return [...this.micros]; }
  findOne(id: number): Micro {
    const micro = this.micros.find((item) => item.id === id);
    if (!micro) throw new NotFoundException('El micro no existe');
    return micro;
  }

  private verificarDuplicados(placa: string, interno: string, ignorarId?: number) {
    if (this.micros.some((m) => m.id !== ignorarId &&
        (m.placa.toUpperCase() === placa.toUpperCase() || m.interno.toUpperCase() === interno.toUpperCase()))) {
      throw new ConflictException('La placa o el número interno ya está registrado');
    }
  }

  create(dto: CreateMicroDto): Micro {
    this.lineas.findOne(dto.lineaId);
    const placa = dto.placa.trim().toUpperCase();
    const interno = dto.interno.trim();
    this.verificarDuplicados(placa, interno);
    const micro: Micro = { ...dto, placa, interno, id: this.nextId++ };
    this.micros.push(micro);
    return micro;
  }

  update(id: number, dto: UpdateMicroDto): Micro {
    const actual = this.findOne(id);
    if (dto.lineaId !== undefined) this.lineas.findOne(dto.lineaId);
    const placa = (dto.placa ?? actual.placa).trim().toUpperCase();
    const interno = (dto.interno ?? actual.interno).trim();
    this.verificarDuplicados(placa, interno, id);
    const actualizado = { ...actual, ...dto, placa, interno };
    this.micros = this.micros.map((m) => m.id === id ? actualizado : m);
    return actualizado;
  }

  remove(id: number): void {
    this.findOne(id);
    this.micros = this.micros.filter((m) => m.id !== id);
  }
}
