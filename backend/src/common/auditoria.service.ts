import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditoriaService {
  constructor(private readonly db: DatabaseService) {}

  async registrar(datos: {
    accion: string;
    entidad: string;
    entidadId?: number;
    detalle?: unknown;
    usuario?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO auditoria (accion, entidad, entidad_id, detalle, usuario)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        datos.accion.slice(0, 120),
        datos.entidad.slice(0, 60),
        datos.entidadId ?? null,
        JSON.stringify(datos.detalle ?? {}),
        datos.usuario ?? 'anónimo',
      ]
    );
  }
}
