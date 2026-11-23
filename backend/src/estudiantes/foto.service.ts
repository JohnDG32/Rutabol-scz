import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

const DIRECTORIO = path.join(process.cwd(), 'uploads', 'fotos');
const BASE_URL = '/uploads/fotos/';
const LIMITE_BYTES = 2 * 1024 * 1024;

// Foto de demostración: se escribe en disco para que la BD no guarde data URLs.
const FOTO_DEMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

/** Extra: guarda las fotografías en disco y deja solo una URL en PostgreSQL. */
@Injectable()
export class FotoService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await fs.mkdir(DIRECTORIO, { recursive: true });
    await fs.writeFile(path.join(DIRECTORIO, 'foto-demo.png'), FOTO_DEMO, { flag: 'wx' }).catch(() => undefined);

    // Migra las data URL que pudieran quedar de versiones anteriores.
    const antiguas = await this.db.query<{ id: number; foto_url: string }>(
      `SELECT id, foto_url FROM estudiantes WHERE foto_url LIKE 'data:image/%'`
    );
    for (const fila of antiguas) {
      const url = await this.guardar(fila.foto_url, `estudiante-${fila.id}`);
      await this.db.query('UPDATE estudiantes SET foto_url = $1 WHERE id = $2', [url, fila.id]);
    }
  }

  /** Convierte una data URL en archivo y devuelve la URL pública para la BD. */
  async guardar(dataUrl: string, prefijo: string): Promise<string> {
    const bytes = this.decodificar(dataUrl);
    const extension = this.extension(dataUrl);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const nombre = `${this.limpiar(prefijo)}-${hash}.${extension}`;
    await fs.writeFile(path.join(DIRECTORIO, nombre), bytes);
    return `${BASE_URL}${nombre}`;
  }

  rutaEnDisco(url: string | null | undefined): string | null {
    if (!url?.startsWith(BASE_URL)) return null;
    const nombre = path.basename(url.slice(BASE_URL.length));
    if (!/^[A-Za-z0-9._-]+$/.test(nombre)) return null;
    return path.join(DIRECTORIO, nombre);
  }

  /** Compara por bytes: sirve tanto para la URL guardada como para una data URL vieja. */
  async coincide(enviada: string, guardada: string): Promise<boolean> {
    if (enviada.trim() === guardada.trim()) return true;
    if (!enviada.startsWith('data:image/')) return false;

    const bytesEnviados = this.decodificar(enviada);
    const ruta = this.rutaEnDisco(guardada);
    const bytesGuardados = ruta
      ? await fs.readFile(ruta).catch(() => null)
      : guardada.startsWith('data:image/')
        ? this.decodificar(guardada)
        : null;
    if (!bytesGuardados) return false;

    const huella = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    return huella(bytesEnviados) === huella(bytesGuardados);
  }

  async borrar(url: string | null | undefined): Promise<void> {
    const ruta = this.rutaEnDisco(url);
    if (ruta) await fs.unlink(ruta).catch(() => undefined);
  }

  private decodificar(dataUrl: string): Buffer {
    const coincidencia = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
    if (!coincidencia) throw new BadRequestException('La fotografía debe ser una imagen en base64');
    const bytes = Buffer.from(coincidencia[2].replace(/\s/g, ''), 'base64');
    if (!bytes.length) throw new BadRequestException('La fotografía está vacía');
    if (bytes.length > LIMITE_BYTES) throw new BadRequestException('La fotografía no debe superar 2 MB');
    return bytes;
  }

  private extension(dataUrl: string): string {
    const tipo = /^data:image\/(png|jpe?g|webp|gif);/i.exec(dataUrl.trim())?.[1].toLowerCase() ?? 'png';
    return tipo === 'jpeg' ? 'jpg' : tipo;
  }

  private limpiar(texto: string): string {
    return texto.normalize('NFD').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'foto';
  }
}
