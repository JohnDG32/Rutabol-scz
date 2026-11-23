import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResumenReporte } from './reporte.interface';

@Injectable()
export class ReportesService {
  constructor(private readonly db: DatabaseService) {}

  /** RF-23: pasajeros, pagos, ocupación y trasbordos registrados. */
  async resumen(): Promise<ResumenReporte> {
    const estados = await this.db.query<{ estado: string; total: number }>(
      'SELECT estado, COUNT(*)::int AS total FROM micros GROUP BY estado ORDER BY estado'
    );
    const porEstado: Record<string, number> = {};
    for (const fila of estados) porEstado[fila.estado] = fila.total;

    const [viajes] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM viajes WHERE estado = 'EN_CURSO'"
    );
    const [abordajes] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM abordajes WHERE registrado_en >= CURRENT_DATE AND estado = 'A BORDO'"
    );
    const [pagos] = await this.db.query<{ total: number; monto: number }>(
      "SELECT COUNT(*)::int AS total, COALESCE(SUM(monto), 0)::float AS monto FROM pagos WHERE estado = 'CONFIRMADO'"
    );
    const [trasbordos] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM trasbordos'
    );
    const [emergencias] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM trasbordos WHERE tipo = 'EMERGENCIA'"
    );
    const [ocupacion] = await this.db.query<{ promedio: number }>(
      `SELECT COALESCE(AVG(total), 0)::float AS promedio FROM (
         SELECT COUNT(a.id) AS total FROM viajes v
         LEFT JOIN abordajes a ON a.viaje_id = v.id AND a.estado = 'A BORDO'
         WHERE v.estado = 'EN_CURSO' GROUP BY v.id
       ) s`
    );

    return {
      micros: { total: estados.reduce((suma, fila) => suma + fila.total, 0), porEstado },
      viajesActivos: viajes.total,
      pasajerosHoy: abordajes.total,
      pagos: { confirmados: pagos.total, totalBs: Number(pagos.monto) },
      trasbordos: trasbordos.total,
      emergencias: emergencias.total,
      ocupacionPromedio: Number(ocupacion.promedio),
    };
  }
}
