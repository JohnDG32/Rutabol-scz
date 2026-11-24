'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { MetricasDashboard, Rol, Usuario } from '@/lib/types';

interface Acceso {
  titulo: string;
  texto: string;
  href: string;
  etiqueta: string;
}

interface Metrica {
  etiqueta: string;
  valor: string;
  detalle: string;
}

const dinero = (valor: number) => new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

function metricasPorRol(rol: Rol, m: MetricasDashboard): Metrica[] {
  const comun: Metrica[] = [
    { etiqueta: 'Líneas', valor: String(m.lineas), detalle: 'en el catálogo' },
    { etiqueta: 'Micros', valor: String(m.micros), detalle: `${m.microsDisponibles} disponibles` },
    { etiqueta: 'Viajes activos', valor: String(m.viajesActivos), detalle: 'en curso' },
    { etiqueta: 'Pagos hoy', valor: String(m.pagosHoy), detalle: 'registrados hoy' },
  ];

  if (rol === 'ADMIN') return [
    ...comun,
    { etiqueta: 'Usuarios activos', valor: String(m.usuariosActivos ?? 0), detalle: 'pueden ingresar' },
    { etiqueta: 'Usuarios inactivos', valor: String(m.usuariosInactivos ?? 0), detalle: 'dados de baja' },
    { etiqueta: 'Recaudado hoy', valor: `Bs ${dinero(m.recaudadoHoyBs)}`, detalle: 'pagos confirmados' },
    { etiqueta: 'Estudiantes', valor: String(m.estudiantesVerificados ?? 0), detalle: 'verificados' },
  ];

  if (rol === 'CONDUCTOR') return [
    ...comun,
    { etiqueta: 'Mis viajes', valor: String(m.misViajesActivos ?? 0), detalle: 'en curso' },
    { etiqueta: 'Abordajes hoy', valor: String(m.misAbordajesHoy ?? 0), detalle: 'a bordo' },
    { etiqueta: 'Posiciones hoy', valor: String(m.posicionesHoy ?? 0), detalle: 'GPS registradas' },
    { etiqueta: 'Conductores', valor: String(m.conductores), detalle: 'activos' },
  ];

  return [
    ...comun,
    { etiqueta: 'Mis pagos', valor: String(m.misPagos ?? 0), detalle: 'historial' },
    { etiqueta: 'Confirmados', valor: String(m.misPagosConfirmados ?? 0), detalle: 'comprobantes' },
    { etiqueta: 'Mi gasto', valor: `Bs ${dinero(m.miGastoBs ?? 0)}`, detalle: 'pagos confirmados' },
    { etiqueta: 'Tarifas', valor: String(m.tarifasVigentes ?? 0), detalle: 'vigentes' },
  ];
}

const accesosPorRol: Record<Rol, Acceso[]> = {
  ADMIN: [
    { titulo: 'Usuarios y roles', texto: 'Alta, edición, cambio de rol y baja de usuarios con contraseña cifrada.', href: '/?tab=usuarios#admin', etiqueta: 'Gestión de acceso' },
    { titulo: 'Panel administrativo', texto: 'Líneas, micros, conductores, tarifas y estudiantes.', href: '/?tab=micros#admin', etiqueta: 'Operación' },
    { titulo: 'Reportes', texto: 'Resumen estadístico y exportación CSV de la operación.', href: '/?tab=reportes#admin', etiqueta: 'Consultas' },
    { titulo: 'Seguimiento de micros', texto: 'Posiciones GPS, mapa real y microesquema de respaldo.', href: '/#cercanos', etiqueta: 'Tiempo real' },
  ],
  CONDUCTOR: [
    { titulo: 'Iniciar viaje', texto: 'Abrir un viaje, registrar abordajes y controlar la ocupación.', href: '/#conductor', etiqueta: 'Operación' },
    { titulo: 'Posición GPS', texto: 'Enviar la ubicación de la micro al sistema.', href: '/#conductor', etiqueta: 'Tiempo real' },
    { titulo: 'Trasbordos y emergencias', texto: 'Derivar pasajeros sin cobrar dos veces.', href: '/#conductor', etiqueta: 'Continuidad' },
    { titulo: 'Consultas públicas', texto: 'Líneas, micros cercanos y tarifas autorizadas.', href: '/#lineas', etiqueta: 'Catálogo' },
  ],
  PASAJERO: [
    { titulo: 'Mi viaje', texto: 'Revisar los viajes en curso y el historial de pagos.', href: '/#pasajero', etiqueta: 'Pasajero' },
    { titulo: 'Pagar pasaje', texto: 'Pago simulado por defecto o Stripe en modo de prueba.', href: '/#pasajero', etiqueta: 'Pagos' },
    { titulo: 'Notificaciones', texto: 'Avisos de capacidad, emergencias y cambios de viaje.', href: '/#pasajero', etiqueta: 'Avisos' },
    { titulo: 'Micros cercanos', texto: 'Consultar la ubicación de las micros en el mapa.', href: '/#cercanos', etiqueta: 'Tiempo real' },
  ],
  ESTUDIANTE: [
    { titulo: 'Mi viaje', texto: 'Abordajes y pagos con la categoría que corresponda.', href: '/#pasajero', etiqueta: 'Estudiante' },
    { titulo: 'Tarifa diferenciada', texto: 'Valida tu condición de estudiante para acceder al beneficio.', href: '/#pasajero', etiqueta: 'Beneficio' },
    { titulo: 'Notificaciones', texto: 'Avisos del sistema y opciones de push cuando estén habilitadas.', href: '/#pasajero', etiqueta: 'Avisos' },
    { titulo: 'Consultas públicas', texto: 'Líneas, micros cercanos y tarifas autorizadas.', href: '/#lineas', etiqueta: 'Catálogo' },
  ],
};

const nombresRoles: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CONDUCTOR: 'Conductor',
  PASAJERO: 'Pasajero',
  ESTUDIANTE: 'Estudiante',
};

export default function Dashboard() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [revisando, setRevisando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setRevisando(true);
    setMetricas(null);
    try {
      const [datosUsuario, datosMetricas] = await Promise.all([
        api.usuarioActual(),
        api.metricasDashboard().catch(() => null),
      ]);
      setUsuario(datosUsuario);
      setMetricas(datosMetricas);
      setError('');
    } catch {
      setUsuario(null);
      setMetricas(null);
    } finally {
      setRevisando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function salir() {
    try { await api.logout(); } catch { /* la sesión ya puede estar vencida */ }
    setUsuario(null);
    router.push('/');
  }

  return (
    <main>
      <header className="cabecera">
        <div className="contenedor nav">
          <div className="marca"><span className="simbolo">R</span><div><strong>RUTABOL-SCZ</strong><small>Panel de acceso por rol</small></div></div>
          <nav>
            <a href="/">Inicio</a>
            {usuario && <a href="/#lineas">Consultas</a>}
            {usuario?.rol === 'ADMIN' && <a href="/?tab=usuarios#admin">Usuarios</a>}
            <a href="/#acceso">Acceso</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="contenedor">
          <div className="etiqueta">DASHBOARD · SESIÓN ACTIVA</div>
          <h1>Tu espacio en <span>RUTABOL-SCZ</span></h1>
          <p>
            Después de iniciar sesión, cada rol ve solamente las herramientas que le corresponden.
            Los accesos de abajo llevan al panel correspondiente dentro de la aplicación.
          </p>
        </div>
      </section>

      <div className="contenedor contenido">
        {error && <div className="alerta error" role="alert">{error}</div>}
        {revisando && <p className="muted">Comprobando sesión...</p>}

        {!revisando && !usuario && (
          <section className="seccion">
            <div className="seccionTitulo">
              <div>
                <span className="sobre">ACCESO REQUERIDO</span>
                <h2>No hay una sesión activa</h2>
                <p>Ingresá con tu usuario para ver el panel de tu rol. Si no tenés credenciales, podés usar los usuarios de demostración del manual.</p>
              </div>
            </div>
            <a className="boton principal" href="/#acceso">Ir a iniciar sesión</a>
          </section>
        )}

        {!revisando && usuario && (
          <section className="seccion">
            <div className="seccionTitulo">
              <div>
                <span className="sobre">BIENVENIDO</span>
                <h2>{usuario.username}</h2>
                <p>Sesión iniciada como <span className={`chip rol-${usuario.rol.toLowerCase()}`}>{nombresRoles[usuario.rol]}</span></p>
              </div>
              <button type="button" className="boton secundario" onClick={() => void salir()}>Cerrar sesión</button>
            </div>

            <div className="dashboardMetricas">
              {metricas ? metricasPorRol(usuario.rol, metricas).map((metrica) => (
                <article className="metrica" key={metrica.etiqueta}>
                  <span>{metrica.etiqueta}</span>
                  <strong>{metrica.valor}</strong>
                  <small>{metrica.detalle}</small>
                </article>
              )) : <p className="muted">No se pudieron cargar las métricas en este momento.</p>}
            </div>

            <div className="tarjetas">
              {accesosPorRol[usuario.rol].map((acceso) => (
                <article className="tarjeta" key={acceso.titulo}>
                  <span className="sobre">{acceso.etiqueta}</span>
                  <h3>{acceso.titulo}</h3>
                  <p>{acceso.texto}</p>
                  <a className="boton principal" href={acceso.href}>Abrir</a>
                </article>
              ))}
            </div>

            <p className="muted">
              La separación se apoya en la cookie <code>rutabol.sid</code> y en el guard de roles del backend:
              aunque un usuario cambie de pestaña o recargue la página, el servidor vuelve a validar su rol y estado.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
