import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditoriaService } from './auditoria.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const CAMPOS_SENSIBLES = new Set(['password', 'passwordHash', 'token', 'foto', 'fotoUrl', 'secret']);

function sanitizar(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const resultado: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(body as Record<string, unknown>)) {
    resultado[clave] = CAMPOS_SENSIBLES.has(clave) ? '[omitido]' : valor;
  }
  return resultado;
}

/** RNF-13: registra las operaciones importantes AFTER de forma exitosa. */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const metodo = req.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo)) return next.handle();

    const segmentos = req.path.split('/').filter(Boolean);
    const entidad = segmentos[1] ?? 'desconocida';
    const entidadId = Number.parseInt(segmentos[2] ?? '', 10);
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap(() => {
        if (res.statusCode >= 400) return;
        void this.auditoria.registrar({
          accion: `${metodo} ${req.path}`,
          entidad,
          entidadId: Number.isFinite(entidadId) ? entidadId : undefined,
          detalle: sanitizar(req.body),
          usuario: req.session?.username,
        }).catch(() => undefined);

        // RF-06/RNF-16: el cambio ya fue persistido, se lo avisa a los navegadores conectados.
        if (entidad !== 'auth') {
          this.realtime.emitirCambio({ entidad, accion: metodo, usuario: req.session?.username });
        }
      })
    );
  }
}
