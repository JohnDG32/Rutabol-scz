import { BadRequestException, Injectable } from '@nestjs/common';
import * as webpush from 'web-push';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { Notificacion } from './notificacion.interface';

export type ModoCorreo = 'DESACTIVADO' | 'ARCHIVO' | 'SMTP';

interface Suscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Extra: entrega de avisos fuera de la web (Web Push y correo).
 * Si no hay claves VAPID ni correo configurado, no hace nada y la demo sigue igual.
 */
@Injectable()
export class NotificacionesExternasService {
  readonly pushActivo: boolean;
  readonly modoCorreo: ModoCorreo;
  private readonly clavePublica: string | null;
  private readonly asunto: string;
  private readonly correos: string[];
  private readonly transporte: nodemailer.Transporter | null = null;
  private readonly directorioCorreos: string;

  constructor(private readonly db: DatabaseService) {
    const publica = process.env.VAPID_PUBLIC_KEY?.trim() || '';
    const privada = process.env.VAPID_PRIVATE_KEY?.trim() || '';
    this.asunto = process.env.VAPID_SUBJECT || 'mailto:demo@rutabol.test';
    this.pushActivo = Boolean(publica && privada);
    this.clavePublica = this.pushActivo ? publica : null;
    if (this.pushActivo) {
      webpush.setVapidDetails(this.asunto, publica, privada);
    }

    const modo = (process.env.NOTIFICACIONES_EMAIL_MODO || 'DESACTIVADO').toUpperCase();
    this.modoCorreo = modo === 'ARCHIVO' || (modo === 'SMTP' && process.env.SMTP_HOST)
      ? modo as ModoCorreo
      : 'DESACTIVADO';
    this.correos = (process.env.NOTIFICACIONES_EMAIL_DESTINO || '')
      .split(',').map((correo) => correo.trim()).filter(Boolean);
    this.directorioCorreos = path.join(process.cwd(), 'uploads', 'correos');

    if (this.modoCorreo === 'SMTP') {
      this.transporte = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' }
          : undefined,
      });
    }
  }

  configuracion(): { push: boolean; correo: ModoCorreo; clavePublica: string | null } {
    return { push: this.pushActivo, correo: this.modoCorreo, clavePublica: this.clavePublica };
  }

  async suscribir(usuarioId: number, suscripcion: Suscripcion): Promise<{ guardada: boolean }> {
    if (!this.pushActivo) throw new BadRequestException('Las notificaciones push no están configuradas');
    if (!/^https?:\/\//i.test(suscripcion.endpoint)) {
      throw new BadRequestException('El endpoint de push no es válido');
    }
    await this.db.query(
      `INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [usuarioId, suscripcion.endpoint, suscripcion.p256dh, suscripcion.auth]
    );
    return { guardada: true };
  }

  async desuscribir(usuarioId: number, endpoint: string): Promise<{ borrada: boolean }> {
    await this.db.query('DELETE FROM suscripciones_push WHERE usuario_id = $1 AND endpoint = $2', [usuarioId, endpoint]);
    return { borrada: true };
  }

  /** Se llama después de insertar cada aviso interno; nunca falla la operación principal. */
  async enviar(aviso: Notificacion): Promise<void> {
    if (!this.pushActivo && this.modoCorreo === 'DESACTIVADO') return;
    await Promise.allSettled([
      this.pushActivo ? this.enviarPush(aviso) : Promise.resolve(),
      this.modoCorreo !== 'DESACTIVADO' ? this.enviarCorreo(aviso) : Promise.resolve(),
    ]);
  }

  private async suscripcionesDe(aviso: Notificacion): Promise<Suscripcion[]> {
    let sql = `SELECT s.endpoint, s.p256dh, s.auth FROM suscripciones_push s
               JOIN usuarios u ON u.id = s.usuario_id WHERE `;
    const parametros: (number | string)[] = [];
    if (aviso.usuarioId) {
      sql += 's.usuario_id = $1';
      parametros.push(aviso.usuarioId);
    } else if (aviso.destino === 'ADMIN') {
      sql += "u.rol = 'ADMIN'";
    } else if (aviso.destino === 'CONDUCTOR') {
      sql += "u.rol = 'CONDUCTOR'";
    } else {
      sql += "u.rol IN ('PASAJERO', 'ESTUDIANTE')";
    }
    return this.db.query<Suscripcion>(sql, parametros);
  }

  private async enviarPush(aviso: Notificacion): Promise<void> {
    const suscripciones = await this.suscripcionesDe(aviso);
    const carga = JSON.stringify({
      title: `RUTABOL-SCZ · ${aviso.tipo}`,
      body: aviso.mensaje,
      url: '/#pasajero',
    });
    for (const suscripcion of suscripciones) {
      try {
        await webpush.sendNotification({
          endpoint: suscripcion.endpoint,
          keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
        }, carga);
      } catch (error) {
        const codigo = (error as { statusCode?: number }).statusCode;
        console.warn(`[Push] aviso=${aviso.id} endpoint=${suscripcion.endpoint} error=${codigo ?? 'desconocido'}`);
        if (codigo === 404 || codigo === 410) {
          await this.db.query('DELETE FROM suscripciones_push WHERE endpoint = $1', [suscripcion.endpoint]);
        }
      }
    }
  }

  private async enviarCorreo(aviso: Notificacion): Promise<void> {
    if (!this.correos.length) return;
    const asunto = `RUTABOL-SCZ · ${aviso.tipo}`;
    const texto = `${aviso.mensaje}\n\nAviso interno #${aviso.id} · ${new Date(aviso.creadoEn).toLocaleString('es-BO')}`;
    if (this.modoCorreo === 'ARCHIVO') {
      fs.mkdirSync(this.directorioCorreos, { recursive: true });
      const archivo = path.join(
        this.directorioCorreos,
        `${Date.now()}-notificacion-${aviso.id}.eml`
      );
      const eml = `From: Rutabol Demo <demo@rutabol.test>\r\nTo: ${this.correos.join(', ')}\r\n` +
        `Subject: ${asunto}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${texto}\r\n`;
      fs.writeFileSync(archivo, eml, 'utf8');
      return;
    }
    await this.transporte!.sendMail({
      from: 'Rutabol Demo <demo@rutabol.test>',
      to: this.correos.join(', '),
      subject: asunto,
      text: texto,
    });
  }
}
