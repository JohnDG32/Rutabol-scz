'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { Linea, MicroCercano } from '@/lib/types';

interface Props {
  centro: { lat: number; lng: number };
  cercanos: MicroCercano[];
  lineas: Linea[];
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[caracter] ?? caracter));
}

/** RF-06/RF-07: mapa callejero real, con vista esquemática como respaldo sin internet. */
export function MapaCercanos({ centro, cercanos, lineas }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const centroInicial = useRef(centro);
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null);
  const [modo, setModo] = useState<'real' | 'esquematico'>('real');
  const [sinConexion, setSinConexion] = useState(false);

  // Leaflet usa window: se importa dinámicamente dentro del efecto para evitar SSR.
  useEffect(() => {
    let cancelado = false;
    let creado: Leaflet.Map | null = null;
    (async () => {
      const L = await import('leaflet');
      if (cancelado || mapaRef.current || !contenedor.current) return;
      const mapa = L.map(contenedor.current, {
        center: [centroInicial.current.lat, centroInicial.current.lng],
        zoom: 13,
        scrollWheelZoom: false,
      });
      creado = mapa;
      mapaRef.current = mapa;

      const capa = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);
      let errores = 0;
      capa.on('tileerror', () => {
        errores += 1;
        if (errores >= 3) setSinConexion(true);
      });
      setLeaflet(L);
    })();
    return () => {
      cancelado = true;
      creado?.remove();
      mapaRef.current = null;
    };
  }, []);

  // Radios, marcadores y popups se redibujan cuando cambia la consulta.
  useEffect(() => {
    const L = leaflet;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;

    const dibujo = L.layerGroup().addTo(mapa);
    L.circle([centro.lat, centro.lng], {
      radius: 5000,
      color: '#0f766e',
      weight: 2,
      fillColor: '#0f766e',
      fillOpacity: 0.06,
      dashArray: '6 6',
    }).addTo(dibujo);

    const iconoOrigen = L.divIcon({
      className: 'marcadorOrigen',
      html: '<span title="Su ubicación">◆</span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker([centro.lat, centro.lng], { icon: iconoOrigen, zIndexOffset: 1000 })
      .addTo(dibujo)
      .bindPopup('<strong>Su ubicación</strong><br>Radio de búsqueda: 5 km');

    cercanos.forEach((micro) => {
      const color = escapar(lineas.find((linea) => linea.id === micro.lineaId)?.color ?? '#0f766e');
      const icono = L.divIcon({
        className: 'marcadorMicro',
        html: `<span style="border-color:${color}">${escapar(micro.interno)}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const linea = lineas.find((l) => l.id === micro.lineaId)?.nombre ?? 'Sin línea';
      L.marker([micro.lat, micro.lng], { icon: icono })
        .addTo(dibujo)
        .bindPopup(
          `<strong>${escapar(micro.interno)}</strong> · ${escapar(micro.placa)}<br>` +
          `${escapar(linea)}<br>${micro.distanciaKm.toFixed(2)} km<br>` +
          `Posición: ${micro.origen === 'GPS_NAVEGADOR' ? 'GPS real' : 'simulada'}`
        );
    });

    if (cercanos.length) {
      const puntos: Leaflet.LatLngExpression[] = [
        [centro.lat, centro.lng],
        ...cercanos.map((micro) => [micro.lat, micro.lng] as [number, number]),
      ];
      mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 14 });
    }

    return () => { dibujo.remove(); };
  }, [leaflet, cercanos, centro, lineas]);

  useEffect(() => {
    if (modo === 'real') mapaRef.current?.invalidateSize();
  }, [modo]);

  const esquema = useMemo(() => {
    if (!cercanos.length) return null;
    const lats = cercanos.map((micro) => micro.lat);
    const lngs = cercanos.map((micro) => micro.lng);
    const margenLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.25, 0.002);
    const margenLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.25, 0.002);
    const minLat = Math.min(...lats, centro.lat) - margenLat;
    const maxLat = Math.max(...lats, centro.lat) + margenLat;
    const minLng = Math.min(...lngs, centro.lng) - margenLng;
    const maxLng = Math.max(...lngs, centro.lng) + margenLng;
    const proyectar = (lat: number, lng: number) => ({
      x: 20 + ((lng - minLng) / (maxLng - minLng)) * 260,
      y: 20 + ((maxLat - lat) / (maxLat - minLat)) * 140,
    });
    return {
      puntos: cercanos.map((micro) => ({ micro, ...proyectar(micro.lat, micro.lng) })),
      origen: proyectar(centro.lat, centro.lng),
    };
  }, [cercanos, centro]);

  return (
    <div className="mapaBloque">
      <div className="mapaCabecera">
        <span className="muted">
          Calles reales de OpenStreetMap · círculo de 5 km (RN-09)
        </span>
        <div className="filtros compactas">
          <button type="button" className={modo === 'real' ? 'boton principal' : 'boton secundario'} onClick={() => setModo('real')}>
            Mapa real
          </button>
          <button type="button" className={modo === 'esquematico' ? 'boton principal' : 'boton secundario'} onClick={() => setModo('esquematico')}>
            Mapa esquemático
          </button>
        </div>
      </div>

      <div className="mapaRealWrap" style={{ display: modo === 'real' ? 'block' : 'none' }}>
        <div ref={contenedor} className="mapaReal" role="application" aria-label="Mapa callejero de micros cercanos" />
        {sinConexion && (
          <p className="mapaAviso">
            No se pudieron cargar las calles (¿sin internet?). Puede seguir con el{' '}
            <button type="button" className="enlace" onClick={() => setModo('esquematico')}>mapa esquemático</button>.
          </p>
        )}
      </div>

      {esquema && (
        <div className="mapaEsquematico" style={{ display: modo === 'esquematico' ? 'block' : 'none' }}>
          <svg viewBox="0 0 300 180" role="img" aria-label="Mapa esquemático de micros cercanos">
            <rect x="0" y="0" width="300" height="180" rx="12" className="mapaFondo" />
            {[40, 80, 120].map((y) => <line key={`h${y}`} x1="10" x2="290" y1={y} y2={y} className="mapaRejilla" />)}
            {[60, 120, 180, 240].map((x) => <line key={`v${x}`} y1="10" y2="170" x1={x} x2={x} className="mapaRejilla" />)}
            <circle cx={esquema.origen.x} cy={esquema.origen.y} r="26" className="mapaRadio" />
            <circle cx={esquema.origen.x} cy={esquema.origen.y} r="4" className="mapaOrigen">
              <title>Su ubicación</title>
            </circle>
            {esquema.puntos.map(({ micro, x, y }) => (
              <g key={micro.id}>
                <circle cx={x} cy={y} r="8" className="mapaPunto" />
                <circle cx={x} cy={y} r="4" fill={lineas.find((l) => l.id === micro.lineaId)?.color ?? '#0f766e'}>
                  <title>{`${micro.interno} · ${micro.distanciaKm.toFixed(2)} km`}</title>
                </circle>
                <text x={x + 10} y={y + 4} className="mapaEtiqueta">{micro.interno}</text>
              </g>
            ))}
          </svg>
          <p className="muted">Mapa esquemático: posición relativa de cada micro. Funciona sin conexión.</p>
        </div>
      )}
    </div>
  );
}
