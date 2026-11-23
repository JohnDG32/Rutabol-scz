'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { obtenerSocket } from '@/lib/socket';
import type { Categoria, Historial, Notificacion, Pago, Viaje } from '@/lib/types';

interface Props {
  viajes: Viaje[];
  avisar: (mensaje: string) => void;
}

const categorias: Categoria[] = ['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'];

export function PanelPasajero({ viajes, avisar }: Props) {
  const [historial, setHistorial] = useState<Historial>({ viajes: [], pagos: [], trasbordos: [], abordajes: [] });
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [viajeId, setViajeId] = useState(0);
  const [categoria, setCategoria] = useState<Categoria>('GENERAL');
  const [token, setToken] = useState('TOKEN-DEMO');
  const [pagoId, setPagoId] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const [modoPago, setModoPago] = useState<'SIMULADO' | 'STRIPE'>('SIMULADO');
  const [monedaPago, setMonedaPago] = useState('usd');

  const cargar = useCallback(async () => {
    try {
      const [datos, misPagos, avisos] = await Promise.all([api.historial(), api.misPagos(), api.notificaciones()]);
      setHistorial(datos);
      setPagos(misPagos);
      setNotificaciones(avisos);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo cargar su información');
    }
  }, [avisar]);

  useEffect(() => {
    void cargar();
    api.configPagos().then((config) => {
      setModoPago(config.modo);
      setMonedaPago(config.moneda);
    }).catch(() => undefined);
    const temporizador = setInterval(() => void cargar(), 60000);
    const socket = obtenerSocket();
    socket.on('cambios', cargar);
    return () => {
      clearInterval(temporizador);
      socket.off('cambios', cargar);
    };
  }, [cargar]);

  // Retorno de Stripe Checkout: el id de sesión viene en la URL y el pago en sessionStorage.
  useEffect(() => {
    const indice = window.location.href.indexOf('?');
    if (indice < 0) return;
    const sessionId = new URLSearchParams(window.location.href.slice(indice + 1)).get('session_id');
    if (!sessionId) return;
    window.history.replaceState(null, '', window.location.pathname + '#pasajero');
    const id = Number(sessionStorage.getItem('rutabol.stripe.pago') || 0);
    if (!id) { avisar('No se pudo identificar el pago al volver de Stripe.'); return; }
    sessionStorage.removeItem('rutabol.stripe.pago');
    void (async () => {
      try {
        await api.confirmarStripe(id, sessionId);
        avisar('Pago confirmado por Stripe. Ya puede registrar el abordaje.');
        await cargar();
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'No se pudo confirmar el pago en Stripe');
      }
    })();
  }, [avisar, cargar]);

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string) {
    setProcesando(true);
    try {
      await accion();
      avisar(mensaje);
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo completar la operación');
    } finally {
      setProcesando(false);
    }
  }

  async function pagar(e: FormEvent) {
    e.preventDefault();
    setProcesando(true);
    try {
      const pago = await api.crearPago(viajeId || viajes[0]?.id || 0, categoria, token);
      if (modoPago === 'STRIPE') {
        sessionStorage.setItem('rutabol.stripe.pago', String(pago.id));
        const sesion = await api.crearCheckout(pago.id);
        window.location.href = sesion.url;
        return;
      }
      avisar('Pago creado. Confirme la transacción para abordar.');
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo crear el pago');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section id="pasajero" className="seccion panelOperativo">
      <div className="seccionTitulo">
        <div>
          <span className="sobre">RF-17 / RF-18 / RF-20 / RF-21</span>
          <h2>Mi viaje</h2>
          <p>{modoPago === 'STRIPE'
            ? 'Pagos con Stripe (modo de prueba), comprobantes, trasbordos y notificaciones.'
            : 'Pagos con pasarela simulada, comprobantes, trasbordos y notificaciones.'}</p>
        </div>
        <button className="boton secundario" onClick={() => void cargar()}>Actualizar</button>
      </div>

      <div className="rejilla">
        <form className="tarjetaForm" onSubmit={(e) => void pagar(e)}>
          <h3>Realizar pago</h3>
          <label>Viaje
            <select value={viajeId || viajes[0]?.id || ''} onChange={(e) => setViajeId(Number(e.target.value))} required>
              {viajes.map((v) => <option key={v.id} value={v.id}>Viaje #{v.id} · {v.interno} · {v.lineaNombre}</option>)}
            </select>
          </label>
          <label>Categoría<select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          {modoPago === 'SIMULADO'
            ? <label>Token simulado de tarjeta<input required maxLength={100} value={token} onChange={(e) => setToken(e.target.value)} /></label>
            : <p className="muted avisoPago">Stripe abrirá una página segura para completar el pago de prueba. El importe se presenta en {monedaPago.toUpperCase()} según la configuración del sandbox.</p>}
          <p className="muted">El sistema calcula la tarifa autorizada. No se almacenan datos reales de tarjeta.</p>
          <button className="boton principal" disabled={procesando || !viajes.length}>{modoPago === 'STRIPE' ? 'Pagar con Stripe' : 'Pagar'}</button>
        </form>

        {modoPago === 'SIMULADO' ? (
          <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.confirmarPago(pagoId), 'Pago confirmado por la pasarela simulada.'); }}>
            <h3>Confirmar pago</h3>
            <label>ID del pago<input type="number" min={1} required value={pagoId || ''} onChange={(e) => setPagoId(Number(e.target.value))} /></label>
            <button className="boton secundario" disabled={procesando}>Confirmar</button>
          </form>
        ) : (
          <article className="tarjetaForm">
            <h3>Confirmación automática</h3>
            <p className="muted avisoPago">Al volver de Stripe, el sistema consulta la sesión y marca el pago como confirmado. No hay que hacer nada más.</p>
          </article>
        )}
      </div>

      <h3 className="subtitulo">Mis pagos</h3>
      <div className="tablaWrap">
        <table>
          <thead><tr><th>ID</th><th>Viaje</th><th>Categoría</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Estado</th></tr></thead>
          <tbody>
            {pagos.map((pago) => (
              <tr key={pago.id}><td>{pago.id}</td><td>{pago.viajeId}</td><td>{pago.categoria}</td>
                <td>{Number(pago.monto).toFixed(2)} Bs</td><td>{pago.metodo}</td><td>{pago.referencia}</td>
                <td><span className={`estado ${pago.estado.toLowerCase()}`}>{pago.estado}</span></td></tr>
            ))}
            {!pagos.length && <tr><td colSpan={7} className="vacio">Todavía no tiene pagos.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="subtitulo">Historial de viajes y trasbordos</h3>
      <div className="panelLista">
        {historial.viajes.map((viaje) => (
          <div className="fila" key={viaje.id}>
            <div><strong>Viaje #{viaje.id}</strong> · {viaje.interno ?? 'micro'}</div>
            <div className="muted">{viaje.lineaNombre ?? `Línea ${viaje.lineaId}`} · {new Date(viaje.iniciadoEn).toLocaleString('es-BO')}</div>
            <div><span className="chip">{viaje.tipo}</span> <span className="chip">{viaje.estado}</span></div>
          </div>
        ))}
        {historial.trasbordos.map((traslado) => (
          <div className="fila" key={traslado.id}>
            <div><strong>Trasbordo #{traslado.id}</strong></div>
            <div className="muted">Del viaje {traslado.viajeOrigenId} al {traslado.viajeDestinoId}</div>
            <div><span className="chip">Pago reutilizado: {traslado.pagoReutilizado ? 'sí' : 'no'}</span></div>
          </div>
        ))}
        {!historial.viajes.length && !historial.trasbordos.length && <p className="muted">Sin viajes registrados todavía.</p>}
      </div>

      <h3 className="subtitulo">Notificaciones</h3>
      <div className="panelLista">
        {notificaciones.map((aviso) => (
          <div className="fila" key={aviso.id}>
            <div><strong>{aviso.tipo}</strong> · {aviso.mensaje}</div>
            <div className="muted">{new Date(aviso.creadoEn).toLocaleString('es-BO')}</div>
            {!aviso.leida && <button className="boton secundario" onClick={() => void ejecutar(() => api.marcarLeida(aviso.id), 'Aviso marcado como leído.')}>Marcar leída</button>}
          </div>
        ))}
        {!notificaciones.length && <p className="muted">No hay notificaciones.</p>}
      </div>
    </section>
  );
}
