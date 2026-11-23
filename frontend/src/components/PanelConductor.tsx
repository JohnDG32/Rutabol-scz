'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Categoria, Micro, Viaje } from '@/lib/types';

interface Props {
  micros: Micro[];
  viajes: Viaje[];
  recargar: () => Promise<void>;
  avisar: (mensaje: string) => void;
}

const categorias: Categoria[] = ['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'];

export function PanelConductor({ micros, viajes, recargar, avisar }: Props) {
  const [microId, setMicroId] = useState(0);
  const [viajeId, setViajeId] = useState(0);
  const [pagoId, setPagoId] = useState(0);
  const [categoria, setCategoria] = useState<Categoria>('GENERAL');
  const [esTrasbordo, setEsTrasbordo] = useState(false);
  const [abordajeId, setAbordajeId] = useState(0);
  const [microDestinoId, setMicroDestinoId] = useState(0);
  const [abordajeIds, setAbordajeIds] = useState('');
  const [motivo, setMotivo] = useState('');
  const [lat, setLat] = useState(-17.7833);
  const [lng, setLng] = useState(-63.1821);
  const [procesando, setProcesando] = useState(false);

  const disponibles = micros.filter((m) => m.autorizado && !['FUERA_DE_SERVICIO', 'EMERGENCIA'].includes(m.estado));
  const viaje = viajes.find((v) => v.id === viajeId) ?? viajes[0];
  const idViaje = viaje?.id ?? 0;

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string) {
    setProcesando(true);
    try {
      await accion();
      avisar(mensaje);
      await recargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo completar la operación');
    } finally {
      setProcesando(false);
    }
  }

  function listaAbordajes(): number[] {
    return abordajeIds.split(',').map((valor) => Number(valor.trim())).filter((n) => Number.isInteger(n) && n > 0);
  }

  return (
    <section id="conductor" className="seccion panelOperativo">
      <div className="seccionTitulo">
        <div>
          <span className="sobre">RF-03 / RF-08 / RF-10 / RF-19</span>
          <h2>Panel del conductor</h2>
          <p>Inicie el viaje, registre abordajes, trasbordos y emergencias. Las reglas se validan en el backend.</p>
        </div>
        <span className="contador">{viajes.length} viajes activos</span>
      </div>

      <div className="rejilla">
        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.iniciarViaje(microId || disponibles[0]?.id || 0), 'Viaje iniciado.'); }}>
          <h3>Iniciar viaje</h3>
          <label>Micro asignado
            <select required value={microId || disponibles[0]?.id || ''} onChange={(e) => setMicroId(Number(e.target.value))}>
              {disponibles.map((m) => <option key={m.id} value={m.id}>{m.interno} — {m.placa}</option>)}
            </select>
          </label>
          <button className="boton principal" disabled={procesando || !disponibles.length}>Iniciar</button>
        </form>

        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.abordar(idViaje, pagoId, categoria, esTrasbordo), 'Abordaje registrado.'); }}>
          <h3>Registrar abordaje</h3>
          <label>Viaje
            <select value={idViaje} onChange={(e) => setViajeId(Number(e.target.value))}>
              {viajes.map((v) => <option key={v.id} value={v.id}>Viaje #{v.id} · {v.interno} ({v.ocupacion}/{v.capacidad})</option>)}
            </select>
          </label>
          <label>ID del pago confirmado<input type="number" min={1} required value={pagoId || ''} onChange={(e) => setPagoId(Number(e.target.value))} /></label>
          <label>Categoría<select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="casilla"><input type="checkbox" checked={esTrasbordo} onChange={(e) => setEsTrasbordo(e.target.checked)} /> Es trasbordo (reutiliza el pago)</label>
          <button className="boton principal" disabled={procesando || !idViaje}>Abordar</button>
        </form>

        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.bajar(idViaje, abordajeId), 'Baja registrada.'); }}>
          <h3>Registrar baja</h3>
          <label>ID del abordaje<input type="number" min={1} required value={abordajeId || ''} onChange={(e) => setAbordajeId(Number(e.target.value))} /></label>
          <button className="boton secundario" disabled={procesando || !idViaje}>Registrar baja</button>
        </form>

        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.trasbordo(idViaje, microDestinoId || disponibles[0]?.id || 0, listaAbordajes()), 'Trasbordo realizado sin nuevo cobro.'); }}>
          <h3>Trasbordo normal</h3>
          <p className="muted">Solo entre micros de la misma línea.</p>
          <label>Micro destino
            <select value={microDestinoId || disponibles[0]?.id || ''} onChange={(e) => setMicroDestinoId(Number(e.target.value))}>
              {disponibles.map((m) => <option key={m.id} value={m.id}>{m.interno} — {m.placa}</option>)}
            </select>
          </label>
          <label>IDs de abordajes a transferir (separados por coma)<input required value={abordajeIds} onChange={(e) => setAbordajeIds(e.target.value)} placeholder="12,13" /></label>
          <button className="boton secundario" disabled={procesando || !idViaje}>Realizar trasbordo</button>
        </form>

        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.emergencia(idViaje, microDestinoId || disponibles[0]?.id || 0, motivo, listaAbordajes()), 'Emergencia registrada y pasajeros notificados.'); }}>
          <h3>Trasbordo de emergencia</h3>
          <label>Motivo<textarea required maxLength={250} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Falla mecánica / emergencia del conductor" /></label>
          <button className="boton peligro" disabled={procesando || !idViaje}>Activar emergencia</button>
        </form>

        <form className="tarjetaForm" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.registrarPosicion(microId || disponibles[0]?.id || 0, lat, lng), 'Posición GPS registrada.'); }}>
          <h3>Actualizar GPS</h3>
          <label>Latitud<input type="number" step="any" required value={lat} onChange={(e) => setLat(Number(e.target.value))} /></label>
          <label>Longitud<input type="number" step="any" required value={lng} onChange={(e) => setLng(Number(e.target.value))} /></label>
          <button className="boton secundario" disabled={procesando}>Enviar posición</button>
        </form>

        <div className="tarjetaForm">
          <h3>Finalizar viaje</h3>
          <p className="muted">Viaje seleccionado: {idViaje ? `#${idViaje}` : 'ninguno'}</p>
          <button className="boton secundario" disabled={procesando || !idViaje} onClick={() => void ejecutar(() => api.finalizarViaje(idViaje), 'Viaje finalizado.')}>Finalizar viaje</button>
        </div>
      </div>
    </section>
  );
}
