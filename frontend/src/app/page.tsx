'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Linea, Micro, Usuario, Viaje } from '@/lib/types';
import { Acceso } from '@/components/Acceso';
import { Consultas } from '@/components/Consultas';
import { PanelAdmin } from '@/components/PanelAdmin';
import { PanelConductor } from '@/components/PanelConductor';
import { PanelPasajero } from '@/components/PanelPasajero';

export default function Home() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const avisar = useCallback((mensaje: string) => setAviso(mensaje), []);

  const cargarCatalogo = useCallback(async () => {
    setError('');
    try {
      const [listaLineas, listaMicros] = await Promise.all([api.lineas(), api.micros()]);
      setLineas(listaLineas);
      setMicros(listaMicros);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
    }
  }, []);

  const cargarViajes = useCallback(async (actual: Usuario | null) => {
    if (!actual) { setViajes([]); return; }
    try {
      if (actual.rol === 'ADMIN' || actual.rol === 'CONDUCTOR') {
        setViajes(await api.viajesActivos());
      } else {
        const historial = await api.historial();
        setViajes(historial.viajes.filter((viaje) => viaje.estado === 'EN_CURSO'));
      }
    } catch {
      setViajes([]);
    }
  }, []);

  const recargar = useCallback(async () => {
    await Promise.all([cargarCatalogo(), cargarViajes(usuario)]);
  }, [cargarCatalogo, cargarViajes, usuario]);

  useEffect(() => { void cargarCatalogo(); }, [cargarCatalogo]);
  useEffect(() => {
    api.usuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setRevisandoSesion(false));
  }, []);
  useEffect(() => { if (!revisandoSesion) void cargarViajes(usuario); }, [usuario, revisandoSesion, cargarViajes]);

  const esOperador = usuario?.rol === 'ADMIN' || usuario?.rol === 'CONDUCTOR';
  const esPasajero = usuario?.rol === 'PASAJERO' || usuario?.rol === 'ESTUDIANTE';

  return (
    <main>
      <header className="cabecera">
        <div className="contenedor nav">
          <div className="marca"><span className="simbolo">R</span><div><strong>RUTABOL-SCZ</strong><small>Transporte público · Santa Cruz de la Sierra</small></div></div>
          <nav>
            <a href="#lineas">Líneas</a>
            <a href="#cercanos">Cercanos</a>
            <a href="#tarifas">Tarifas</a>
            {esOperador && <a href="#conductor">Operación</a>}
            {esPasajero && <a href="#pasajero">Mi viaje</a>}
            {usuario?.rol === 'ADMIN' && <a href="#admin">Administración</a>}
            <a href="#acceso">Acceso</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="contenedor">
          <div className="etiqueta">SISTEMA RUTABOL-SCZ | ACTIVIDAD 01</div>
          <h1>Control, seguridad y transparencia en las <span>micros de Santa Cruz</span></h1>
          <p>
            Registro y validación de micros, control de pasajeros, geolocalización, tarifas autorizadas,
            trasbordos sin doble pago, validación de estudiantes y pagos digitales.
          </p>
          <div className="heroacciones">
            <a className="boton principal" href="#lineas">Explorar líneas</a>
            <a className="boton claro" href="#acceso">Ingresar al sistema</a>
          </div>
          <p className="advertencia">
            Proyecto académico: líneas, posiciones GPS y pasarela de pagos son simulados. No representan operación oficial.
          </p>
        </div>
      </section>

      <div className="contenedor contenido">
        {error && <div className="alerta error" role="alert">{error} <button onClick={() => void cargarCatalogo()}>Reintentar</button></div>}
        {aviso && <div className="alerta exito" role="status">{aviso} <button onClick={() => setAviso('')}>Cerrar</button></div>}
        {revisandoSesion && <p className="muted">Comprobando sesión...</p>}

        <Consultas lineas={lineas} micros={micros} avisar={avisar} />

        {esOperador && <PanelConductor micros={micros} viajes={viajes} recargar={recargar} avisar={avisar} />}
        {esPasajero && <PanelPasajero viajes={viajes} avisar={avisar} />}
        {usuario?.rol === 'ADMIN' && <PanelAdmin lineas={lineas} micros={micros} recargar={recargar} avisar={avisar} />}

        <Acceso usuario={usuario} onSesion={setUsuario} avisar={avisar} />
        <footer>RUTABOL-SCZ · Tecnología Web I · Requerimientos funcionales y no funcionales</footer>
      </div>
    </main>
  );
}
