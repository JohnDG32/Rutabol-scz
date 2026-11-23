import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FiltrosReporte, ResumenReporte } from './reporte.interface';

interface ParteFiltro { sql: string; params: unknown[] }

@Injectable()
export class ReportesService {
  constructor(private readonly db: DatabaseService) {}

  /** Construye predicados parametrizados reutilizables para fecha y línea. */
  private filtro(filtros: FiltrosReporte, columnaFecha: string, columnaLinea: string): ParteFiltro {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtros.desde) { params.push(filtros.desde); condiciones.push(`${columnaFecha} >= $${params.length}`); }
    if (filtros.hasta) { params.push(filtros.hasta); condiciones.push(`${columnaFecha} < $${params.length}`); }
    if (filtros.lineaId) { params.push(filtros.lineaId); condiciones.push(`${columnaLinea} = $${params.length}`); }
    return { sql: condiciones.length ? ' AND ' + condiciones.join(' AND ') : '', params };
  }

  /** RF-23: pasajeros, pagos, ocupación y trasbordos registrados. */
  async resumen(filtros: FiltrosReporte = {}): Promise<ResumenReporte> {
    const estados = await this.db.query<{ estado: string; total: number }>(
      'SELECT estado, COUNT(*)::int AS total FROM micros GROUP BY estado ORDER BY estado'
    );
    const porEstado: Record<string, number> = {};
    for (const fila of estados) porEstado[fila.estado] = fila.total;

    const fViajes = this.filtro(filtros, 'v.iniciado_en', 'v.linea_id');
    const [viajes] = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM viajes v
       WHERE v.estado = 'EN_CURSO'${fViajes.sql}`, fViajes.params
    );

    const fAbordajes = this.filtro(filtros, 'a.registrado_en', 'v.linea_id');
    const fechaAbordajes = filtros.desde ? '' : ' AND a.registrado_en >= CURRENT_DATE';
    const [abordajes] = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM abordajes a
       JOIN viajes v ON v.id = a.viaje_id
       WHERE a.estado = 'A BORDO'${fechaAbordajes}${fAbordajes.sql}`, fAbordajes.params
    );

    const fPagos = this.filtro(filtros, 'p.creado_en', 'v.linea_id');
    const [pagos] = await this.db.query<{ total: number; monto: number }>(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(p.monto), 0)::float AS monto
       FROM pagos p JOIN viajes v ON v.id = p.viaje_id
       WHERE p.estado = 'CONFIRMADO'${fPagos.sql}`, fPagos.params
    );

    const fTrasbordos = this.filtro(filtros, 't.creado_en', 'v.linea_id');
    const [trasbordos] = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM trasbordos t
       JOIN viajes v ON v.id = t.viaje_origen_id WHERE TRUE${fTrasbordos.sql}`, fTrasbordos.params
    );
    const [emergencias] = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM trasbordos t
       JOIN viajes v ON v.id = t.viaje_origen_id
       WHERE t.tipo = 'EMERGENCIA'${fTrasbordos.sql}`, fTrasbordos.params
    );

    const fOcupacion = this.filtro(filtros, 'v.iniciado_en', 'v.linea_id');
    const [ocupacion] = await this.db.query<{ promedio: number }>(
      `SELECT COALESCE(AVG(total), 0)::float AS promedio FROM (
         SELECT COUNT(a.id) AS total FROM viajes v
         LEFT JOIN abordajes a ON a.viaje_id = v.id AND a.estado = 'A BORDO'
         WHERE v.estado = 'EN_CURSO'${fOcupacion.sql} GROUP BY v.id
       ) s`, fOcupacion.params
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

  /** RF-23: exportación de comprobantes confirmados a CSV (compatible con Excel). */
  async exportarCsv(filtros: FiltrosReporte = {}): Promise<string> {
    const f = this.filtro(filtros, 'p.creado_en', 'v.linea_id');
    const filas = await this.db.query<{
      fecha: string; viajeId: number; linea: string; categoria: string;
      monto: number; estado: string; referencia: string; usuario: string | null;
    }>(
      `SELECT to_char(p.creado_en, 'YYYY-MM-DD HH24:MI') AS fecha,
              p.viaje_id AS "viajeId", l.nombre AS linea, p.categoria,
              p.monto, p.estado, p.referencia, u.username AS usuario
       FROM pagos p
       JOIN viajes v ON v.id = p.viaje_id
       JOIN lineas l ON l.id = v.linea_id
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.estado = 'CONFIRMADO'${f.sql}
       ORDER BY p.creado_en DESC`, f.params
    );
    const celda = (valor: unknown): string => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const cabecera = ['Fecha', 'Viaje', 'Línea', 'Categoría', 'Monto (Bs)', 'Estado', 'Referencia', 'Usuario'];
    const lineas = [cabecera.map(celda).join(';')];
    for (const fila of filas) {
      lineas.push([
        fila.fecha, fila.viajeId, fila.linea, fila.categoria,
        Number(fila.monto).toFixed(2), fila.estado, fila.referencia, fila.usuario,
      ].map(celda).join(';'));
    }
    return '\uFEFF' + lineas.join('\r\n') + '\r\n';
  }
}
