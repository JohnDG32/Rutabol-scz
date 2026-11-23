'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Categoria, Linea, Micro, MicroCercano, Tarifa } from '@/lib/types';

interface Props {
  lineas: Linea[];
  micros: Micro[];
  avisar: (mensaje: string) => void;
}

const UBICACION_DEMO = { lat: -17.7833, lng: -63.1821 };
const categorias: Categoria[] = ['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'];

export function Consultas({ lineas, micros, avisar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [lineaTarifa, setLineaTarifa] = useState(0);
  const [categoria, setCategoria] = useState<Categoria>('GENERAL');
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cercanos, setCercanos] = useState<MicroCercano[]>([]);
  const [buscando, setBuscando] = useState(false);

  const microsFiltrados = useMemo(() => micros.filter((micro) => {
    const coincideLinea = filtro === 'todas' || micro.lineaId === Number(filtro);
    return coincideLinea && `${micro.placa} ${micro.interno}`.toLowerCase().includes(busqueda.toLowerCase());
  }), [micros, filtro, busqueda]);

  useEffect(() => {
    api.tarifas(lineaTarifa || undefined, categoria)
      .then(setTarifas)
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : 'No se pudieron cargar las tarifas'));
  }, [lineaTarifa, categoria, avisar]);

  async function cargarCercanos(lat: number, lng: number) {
    setBuscando(true);
    try {
      const datos = await api.microsCercanos(lat, lng, 5);
      setCercanos(datos);
      avisar(datos.length ? `${datos.length} micros dentro de 5 km.` : 'No hay micros con posición reciente en 5 km.');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo consultar la ubicación');
    } finally {
      setBuscando(false);
    }
  }

  function usarGps() {
    if (!navigator.geolocation) {
      void cargarCercanos(UBICACION_DEMO.lat, UBICACION_DEMO.lng);
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => { void cargarCercanos(posicion.coords.latitude, posicion.coords.longitude); },
      () => { void cargarCercanos(UBICACION_DEMO.lat, UBICACION_DEMO.lng); },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  return (
    <>
      <section id="lineas" className="seccion">
        <div className="seccionTitulo">
          <div>
            <span className="sobre">CATÁLOGO PÚBLICO</span>
            <h2>Líneas disponibles</h2>
            <p>Información de demostración recibida desde <code>GET /api/lineas</code>.</p>
          </div>
          <span className="contador">{lineas.length} líneas</span>
        </div>
        <div className="tarjetas">
          {lineas.map((linea) => (
            <article className="tarjeta" key={linea.id} style={{ borderTopColor: linea.color }}>
              <div className="tarjetaIcono" style={{ backgroundColor: linea.color }}>L{linea.id}</div>
              <div className="tarjetaInfo">
                <h3>{linea.nombre}</h3>
                <span className="zona">{linea.zona}</span>
                <p>{linea.descripcion}</p>
                <span className="chip">{micros.filter((m) => m.lineaId === linea.id).length} micros registrados</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="micros" className="seccion">
        <div className="seccionTitulo">
          <div>
            <span className="sobre">RF-06 / RF-07 / RF-24</span>
            <h2>Micros y disponibilidad</h2>
            <p>Consulta estado, ocupación y autorización de cada unidad.</p>
          </div>
          <span className="contador">{microsFiltrados.length} resultados</span>
        </div>
        <div className="filtros">
          <input aria-label="Buscar micro" placeholder="Buscar por placa o número interno" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select aria-label="Filtrar por línea" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todas">Todas las líneas</option>
            {lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}
          </select>
        </div>
        <div className="tablaWrap">
          <table>
            <thead><tr><th>Placa</th><th>Interno</th><th>Línea</th><th>Ocupación</th><th>Autorizado</th><th>Estado</th></tr></thead>
            <tbody>
              {microsFiltrados.map((micro) => (
                <tr key={micro.id}>
                  <td><strong>{micro.placa}</strong></td>
                  <td>{micro.interno}</td>
                  <td>{lineas.find((l) => l.id === micro.lineaId)?.nombre ?? 'Sin línea'}</td>
                  <td>{micro.ocupacion}/{micro.capacidad}</td>
                  <td>{micro.autorizado ? 'Sí' : 'No'}</td>
                  <td><span className={`estado ${micro.estado.toLowerCase()}`}>{micro.estado}</span></td>
                </tr>
              ))}
              {!microsFiltrados.length && <tr><td colSpan={6} className="vacio">No hay micros para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cercanos" className="seccion">
        <div className="seccionTitulo">
          <div>
            <span className="sobre">GEOLOCALIZACIÓN</span>
            <h2>Micros cercanos</h2>
            <p>Radio de búsqueda: 5 kilómetros (RN-09). Ubicaciones simuladas con GPS de demostración.</p>
          </div>
          <button className="boton principal" onClick={usarGps} disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar con mi ubicación'}
          </button>
        </div>
        <div className="panelLista">
          {cercanos.length ? cercanos.map((micro) => (
            <div className="fila" key={micro.id}>
              <div><strong>{micro.interno}</strong> · {micro.placa}</div>
              <div className="muted">{lineas.find((l) => l.id === micro.lineaId)?.nombre}</div>
              <div><span className="chip">{micro.distanciaKm.toFixed(2)} km</span></div>
            </div>
          )) : <p className="muted">Aún no hay resultados. Use el botón para consultar posiciones registradas.</p>}
        </div>
      </section>

      <section id="tarifas" className="seccion">
        <div className="seccionTitulo">
          <div>
            <span className="sobre">RF-04 / RF-05</span>
            <h2>Consulta de tarifas</h2>
            <p>Precio oficial autorizado antes de abordar.</p>
          </div>
          <div className="filtros compactas">
            <select aria-label="Línea para consultar tarifa" value={lineaTarifa} onChange={(e) => setLineaTarifa(Number(e.target.value))}>
              <option value={0}>Todas las líneas</option>
              {lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}
            </select>
            <select aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="tablaWrap">
          <table>
            <thead><tr><th>Línea</th><th>Categoría</th><th>Monto (Bs)</th><th>Vigente desde</th></tr></thead>
            <tbody>
              {tarifas.map((tarifa) => (
                <tr key={tarifa.id}>
                  <td>{lineas.find((l) => l.id === tarifa.lineaId)?.nombre ?? tarifa.lineaId}</td>
                  <td>{tarifa.categoria}</td>
                  <td><strong>{Number(tarifa.monto).toFixed(2)}</strong></td>
                  <td>{new Date(tarifa.vigenteDesde).toLocaleDateString('es-BO')}</td>
                </tr>
              ))}
              {!tarifas.length && <tr><td colSpan={4} className="vacio">No hay tarifas autorizadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
