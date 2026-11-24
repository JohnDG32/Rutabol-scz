import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Rol } from '../common/roles';
import { MetricasDashboard } from './metricas.interface';

interface ConteoGeneral {
  lineas: number;
  micros: number;
  microsDisponibles: number;
  conductores: number;
  viajesActivos: number;
  pagosHoy: number;
  recaudadoHoyBs: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async obtener(usuarioId: number): Promise<MetricasDashboard> {
    const usuarios = await this.db.query<{ rol: Rol }>(
      'SELECT rol FROM usuarios WHERE id = $1', [usuarioId]
    );
    if (!usuarios[0]) throw new UnauthorizedException('El usuario ya no existe');
    const rol = usuarios[0].rol;

    const [generales] = await this.db.query<ConteoGeneral>(`
      SELECT
        (SELECT COUNT(*)::int FROM lineas) AS lineas,
        (SELECT COUNT(*)::int FROM micros) AS micros,
        (SELECT COUNT(*)::int FROM micros WHERE autorizado AND estado = 'DISPONIBLE') AS "microsDisponibles",
        (SELECT COUNT(*)::int FROM conductores WHERE activo) AS conductores,
        (SELECT COUNT(*)::int FROM viajes WHERE estado = 'EN_CURSO') AS "viajesActivos",
        (SELECT COUNT(*)::int FROM pagos WHERE creado_en >= CURRENT_DATE) AS "pagosHoy",
        (SELECT COALESCE(SUM(monto), 0)::float FROM pagos
          WHERE estado = 'CONFIRMADO' AND creado_en >= CURRENT_DATE) AS "recaudadoHoyBs"
    `);

    const base: MetricasDashboard = {
      rol,
      lineas: generales.lineas,
      micros: generales.micros,
      microsDisponibles: generales.microsDisponibles,
      conductores: generales.conductores,
      viajesActivos: generales.viajesActivos,
      pagosHoy: generales.pagosHoy,
      recaudadoHoyBs: Number(generales.recaudadoHoyBs),
    };

    if (rol === 'ADMIN') {
      const [usuarios] = await this.db.query<{ activos: number; inactivos: number }>(`
        SELECT SUM(CASE WHEN activo THEN 1 ELSE 0 END)::int AS activos,
               SUM(CASE WHEN NOT activo THEN 1 ELSE 0 END)::int AS inactivos
        FROM usuarios
      `);
      const [verificados] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM estudiantes WHERE verificado'
      );
      return {
        ...base,
        usuariosActivos: usuarios.activos,
        usuariosInactivos: usuarios.inactivos,
        estudiantesVerificados: verificados.total,
      };
    }

    if (rol === 'CONDUCTOR') {
      const [viajes] = await this.db.query<{ total: number }>(`
        SELECT COUNT(*)::int AS total FROM viajes v
        JOIN conductores c ON c.id = v.conductor_id
        WHERE v.estado = 'EN_CURSO' AND c.usuario_id = $1
      `, [usuarioId]);
      const [abordajes] = await this.db.query<{ total: number }>(`
        SELECT COUNT(*)::int AS total FROM abordajes a
        JOIN viajes v ON v.id = a.viaje_id
        JOIN conductores c ON c.id = v.conductor_id
        WHERE c.usuario_id = $1 AND a.registrado_en >= CURRENT_DATE
      `, [usuarioId]);
      const [posiciones] = await this.db.query<{ total: number }>(`
        SELECT COUNT(*)::int AS total FROM posiciones p
        JOIN conductores c ON c.micro_id = p.micro_id
        WHERE c.usuario_id = $1 AND p.registrado_en >= CURRENT_DATE
      `, [usuarioId]);
      return {
        ...base,
        misViajesActivos: viajes.total,
        misAbordajesHoy: abordajes.total,
        posicionesHoy: posiciones.total,
      };
    }

    const [pagos] = await this.db.query<{ total: number; confirmados: number; gasto: number }>(`
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(CASE WHEN estado = 'CONFIRMADO' THEN 1 ELSE 0 END), 0)::int AS confirmados,
             COALESCE(SUM(CASE WHEN estado = 'CONFIRMADO' THEN monto ELSE 0 END), 0)::float AS gasto
      FROM pagos WHERE usuario_id = $1
    `, [usuarioId]);
    const [tarifas] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM tarifas WHERE activa'
    );
    return {
      ...base,
      misPagos: pagos.total,
      misPagosConfirmados: pagos.confirmados,
      miGastoBs: Number(pagos.gasto),
      tarifasVigentes: tarifas.total,
    };
  }
}
