import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificacionesExternasService } from './notificaciones-externas.service';
import { DestinoNotificacion, Notificacion } from './notificacion.interface';
import type { Rol } from '../common/roles';

const COLUMNAS = `id, destino, tipo, mensaje, usuario_id AS "usuarioId", leida,
  creado_en AS "creadoEn"`;

@Injectable()
export class NotificacionesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly externas: NotificacionesExternasService,
  ) {}

  async crear(
    destino: DestinoNotificacion,
    tipo: string,
    mensaje: string,
    usuarioId?: number,
  ): Promise<Notificacion> {
    const rows = await this.db.query<Notificacion>(
      `INSERT INTO notificaciones (destino, tipo, mensaje, usuario_id)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
      [destino, tipo, mensaje, usuarioId ?? null]
    );
    // Extra: push y correo son best-effort; un fallo externo no afecta al RF-20.
    void this.externas.enviar(rows[0]).catch(() => undefined);
    return rows[0];
  }

  /** RF-20/RF-10: cada rol ve los avisos dirigidos a él y los generales. */
  listar(usuarioId: number, rol: Rol): Promise<Notificacion[]> {
    if (rol === 'ADMIN') {
      return this.db.query<Notificacion>(
        `SELECT ${COLUMNAS} FROM notificaciones ORDER BY creado_en DESC, id DESC LIMIT 100`
      );
    }
    const destino = rol === 'CONDUCTOR' ? 'CONDUCTOR' : 'PASAJEROS';
    return this.db.query<Notificacion>(
      `SELECT ${COLUMNAS} FROM notificaciones
       WHERE (destino = $1 AND (usuario_id IS NULL OR usuario_id = $2)) OR usuario_id = $2
       ORDER BY creado_en DESC, id DESC LIMIT 100`,
      [destino, usuarioId]
    );
  }

  async marcarLeida(id: number): Promise<Notificacion> {
    const rows = await this.db.query<Notificacion>(
      `UPDATE notificaciones SET leida = TRUE WHERE id = $1 RETURNING ${COLUMNAS}`, [id]
    );
    if (!rows[0]) throw new NotFoundException('La notificación no existe');
    return rows[0];
  }
}
