'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { obtenerSocket } from '@/lib/socket';
import type {
  Categoria, Conductor, ConductorInput, Estudiante, Linea, Micro, MicroInput,
  FiltrosReporte, ResumenReporte, Tarifa,
} from '@/lib/types';

interface Props {
  lineas: Linea[];
  micros: Micro[];
  recargar: () => Promise<void>;
  avisar: (mensaje: string) => void;
}

type Pestana = 'lineas' | 'micros' | 'conductores' | 'tarifas' | 'estudiantes' | 'reportes';

const estados: Micro['estado'][] = ['DISPONIBLE', 'EN_CIRCULACION', 'LLENO', 'FUERA_DE_SERVICIO', 'EMERGENCIA'];
const categorias: Categoria[] = ['GENERAL', 'ESCOLAR', 'UNIVERSITARIO'];

const microInicial: MicroInput = {
  placa: '', interno: '', capacidad: 22, estado: 'DISPONIBLE', autorizado: false, lineaId: 1,
};
const conductorInicial: ConductorInput = {
  nombre: '', apellido: '', ci: '', telefono: '', microId: null, activo: true,
};
const estudianteInicial = {
  nombre: '', apellido: '', ci: '', categoria: 'ESCOLAR' as 'ESCOLAR' | 'UNIVERSITARIO',
  codigo: '', correoInstitucional: '', fotoUrl: '',
};

function leerFoto(archivo: File | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!archivo) { resolve(''); return; }
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result ?? ''));
    lector.onerror = () => reject(new Error('No se pudo leer la fotografía'));
    lector.readAsDataURL(archivo);
  });
}

export function PanelAdmin({ lineas, micros, recargar, avisar }: Props) {
  const [pestana, setPestana] = useState<Pestana>('micros');
  const [lineaForm, setLineaForm] = useState({ nombre: '', zona: '', descripcion: '', color: '#0f766e' });
  const [lineaEditando, setLineaEditando] = useState<number | null>(null);
  const [microForm, setMicroForm] = useState<MicroInput>(microInicial);
  const [microEditando, setMicroEditando] = useState<number | null>(null);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [conductorForm, setConductorForm] = useState<ConductorInput>(conductorInicial);
  const [conductorEditando, setConductorEditando] = useState<number | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [tarifaForm, setTarifaForm] = useState({ lineaId: 1, categoria: 'GENERAL' as Categoria, monto: 2.5 });
  const [tarifaEditando, setTarifaEditando] = useState<number | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteForm, setEstudianteForm] = useState(estudianteInicial);
  const [validacion, setValidacion] = useState({ categoria: 'ESCOLAR' as 'ESCOLAR' | 'UNIVERSITARIO', codigo: '', fotoUrl: '' });
  const [reporte, setReporte] = useState<ResumenReporte | null>(null);
  const [filtros, setFiltros] = useState<FiltrosReporte>({});
  const [procesando, setProcesando] = useState(false);

  const cargarSeccion = useCallback(async (seccion: Pestana) => {
    try {
      if (seccion === 'conductores') setConductores(await api.conductores());
      if (seccion === 'tarifas') setTarifas(await api.tarifas(0));
      if (seccion === 'estudiantes') setEstudiantes(await api.estudiantes());
      if (seccion === 'reportes') setReporte(await api.resumen(filtros));
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo cargar la sección');
    }
  }, [avisar, filtros]);

  useEffect(() => { void cargarSeccion(pestana); }, [pestana, cargarSeccion]);

  useEffect(() => {
    const socket = obtenerSocket();
    const alCambiar = () => { void cargarSeccion(pestana); };
    socket.on('cambios', alCambiar);
    return () => { socket.off('cambios', alCambiar); };
  }, [cargarSeccion, pestana]);

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string, recargarGeneral = false) {
    setProcesando(true);
    try {
      await accion();
      avisar(mensaje);
      if (recargarGeneral) await recargar();
      await cargarSeccion(pestana);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo completar la operación');
      return false;
    } finally {
      setProcesando(false);
    }
  }

  async function guardarLinea(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const exito = await ejecutar(
      () => lineaEditando === null ? api.crearLinea(lineaForm) : api.actualizarLinea(lineaEditando, lineaForm),
      lineaEditando === null ? 'Línea registrada.' : 'Línea actualizada.', true
    );
    if (exito) { setLineaEditando(null); setLineaForm({ nombre: '', zona: '', descripcion: '', color: '#0f766e' }); }
  }

  function editarMicro(micro: Micro) {
    setMicroEditando(micro.id);
    setMicroForm({ placa: micro.placa, interno: micro.interno, capacidad: micro.capacidad,
      estado: micro.estado, autorizado: micro.autorizado, lineaId: micro.lineaId });
  }

  function limpiarMicro() { setMicroEditando(null); setMicroForm({ ...microInicial, lineaId: lineas[0]?.id ?? 1 }); }

  async function guardarMicro(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const exito = await ejecutar(
      () => microEditando === null ? api.crearMicro(microForm) : api.actualizarMicro(microEditando, microForm),
      microEditando === null ? 'Micro registrado.' : 'Micro actualizado.', true
    );
    if (exito) limpiarMicro();
  }

  async function guardarConductor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const exito = await ejecutar(
      () => conductorEditando === null ? api.crearConductor(conductorForm) : api.actualizarConductor(conductorEditando, conductorForm),
      conductorEditando === null ? 'Conductor registrado.' : 'Conductor actualizado.'
    );
    if (exito) { setConductorEditando(null); setConductorForm({ ...conductorInicial }); }
  }

  async function guardarTarifa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const exito = await ejecutar(
      () => tarifaEditando === null ? api.crearTarifa(tarifaForm) : api.actualizarTarifa(tarifaEditando, { monto: tarifaForm.monto, activa: true }),
      tarifaEditando === null ? 'Tarifa autorizada creada.' : 'Tarifa actualizada.'
    );
    if (exito) { setTarifaEditando(null); setTarifaForm({ lineaId: 1, categoria: 'GENERAL', monto: 2.5 }); }
  }

  async function guardarEstudiante(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const exito = await ejecutar(() => api.crearEstudiante(estudianteForm), 'Estudiante registrado. Pendiente de verificación.');
    if (exito) setEstudianteForm({ ...estudianteInicial });
  }

  return (
    <section id="admin" className="seccion panelOperativo">
      <div className="seccionTitulo">
        <div>
          <span className="sobre">RF-22 / RF-23</span>
          <h2>Panel administrativo</h2>
          <p>Gestión de micros, conductores, tarifas, estudiantes y reportes estadísticos.</p>
        </div>
      </div>

      <div className="pestanas">
        {(['lineas', 'micros', 'conductores', 'tarifas', 'estudiantes', 'reportes'] as Pestana[]).map((p) => (
          <button key={p} className={pestana === p ? 'activa' : ''} onClick={() => setPestana(p)}>{p}</button>
        ))}
      </div>

      {pestana === 'lineas' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => void guardarLinea(e)}>
            <h3 className="ancho">{lineaEditando === null ? 'Registrar línea' : `Editar línea #${lineaEditando}`}</h3>
            <label>Nombre<input required maxLength={100} value={lineaForm.nombre} onChange={(e) => setLineaForm({ ...lineaForm, nombre: e.target.value })} /></label>
            <label>Zona<input required maxLength={80} value={lineaForm.zona} onChange={(e) => setLineaForm({ ...lineaForm, zona: e.target.value })} /></label>
            <label className="ancho">Descripción<textarea required value={lineaForm.descripcion} onChange={(e) => setLineaForm({ ...lineaForm, descripcion: e.target.value })} /></label>
            <label>Color (hex)<input required type="color" value={lineaForm.color} onChange={(e) => setLineaForm({ ...lineaForm, color: e.target.value })} /></label>
            <div className="formAcciones"><button className="boton principal" disabled={procesando}>Guardar línea</button></div>
          </form>
          <div className="tablaWrap">
            <table>
              <thead><tr><th>Línea</th><th>Zona</th><th>Descripción</th><th>Acciones</th></tr></thead>
              <tbody>
                {lineas.map((linea) => (
                  <tr key={linea.id}><td><strong>{linea.nombre}</strong></td><td>{linea.zona}</td><td>{linea.descripcion}</td>
                    <td className="acciones"><button onClick={() => { setLineaEditando(linea.id); setLineaForm({ nombre: linea.nombre, zona: linea.zona, descripcion: linea.descripcion, color: linea.color }); }}>Editar</button>
                      <button className="peligro" onClick={() => void ejecutar(() => api.eliminarLinea(linea.id), 'Línea eliminada.', true)}>Eliminar</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'micros' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => void guardarMicro(e)}>
            <h3 className="ancho">{microEditando === null ? 'Registrar micro' : `Editar micro #${microEditando}`}</h3>
            <label>Placa<input required maxLength={20} value={microForm.placa} onChange={(e) => setMicroForm({ ...microForm, placa: e.target.value })} /></label>
            <label>Número interno<input required maxLength={20} value={microForm.interno} onChange={(e) => setMicroForm({ ...microForm, interno: e.target.value })} /></label>
            <label>Capacidad (18–25)<input required type="number" min={18} max={25} value={microForm.capacidad} onChange={(e) => setMicroForm({ ...microForm, capacidad: Number(e.target.value) })} /></label>
            <label>Estado<select value={microForm.estado} onChange={(e) => setMicroForm({ ...microForm, estado: e.target.value as Micro['estado'] })}>{estados.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Línea<select required value={microForm.lineaId} onChange={(e) => setMicroForm({ ...microForm, lineaId: Number(e.target.value) })}>{lineas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label>
            <label className="casilla"><input type="checkbox" checked={microForm.autorizado} onChange={(e) => setMicroForm({ ...microForm, autorizado: e.target.checked })} /> Autorizado para operar</label>
            <div className="formAcciones">
              <button className="boton principal" disabled={procesando}>{microEditando === null ? 'Registrar' : 'Guardar cambios'}</button>
              {microEditando !== null && <button type="button" className="boton secundario" onClick={limpiarMicro}>Cancelar</button>}
            </div>
          </form>
          <div className="tablaWrap">
            <table>
              <thead><tr><th>Interno</th><th>Placa</th><th>Línea</th><th>Capacidad</th><th>Autorizado</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {micros.map((micro) => (
                  <tr key={micro.id}>
                    <td>{micro.interno}</td><td>{micro.placa}</td>
                    <td>{lineas.find((l) => l.id === micro.lineaId)?.nombre}</td>
                    <td>{micro.capacidad}</td><td>{micro.autorizado ? 'Sí' : 'No'}</td>
                    <td><span className={`estado ${micro.estado.toLowerCase()}`}>{micro.estado}</span></td>
                    <td className="acciones"><button onClick={() => editarMicro(micro)}>Editar</button>
                      <button className="peligro" onClick={() => void ejecutar(() => api.eliminarMicro(micro.id), 'Micro eliminado.', true)}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'conductores' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => void guardarConductor(e)}>
            <h3 className="ancho">{conductorEditando === null ? 'Registrar conductor' : `Editar conductor #${conductorEditando}`}</h3>
            <label>Nombre<input required maxLength={100} value={conductorForm.nombre} onChange={(e) => setConductorForm({ ...conductorForm, nombre: e.target.value })} /></label>
            <label>Apellido<input required maxLength={100} value={conductorForm.apellido} onChange={(e) => setConductorForm({ ...conductorForm, apellido: e.target.value })} /></label>
            <label>Cédula<input required maxLength={30} value={conductorForm.ci} onChange={(e) => setConductorForm({ ...conductorForm, ci: e.target.value })} /></label>
            <label>Teléfono<input maxLength={30} value={conductorForm.telefono ?? ''} onChange={(e) => setConductorForm({ ...conductorForm, telefono: e.target.value })} /></label>
            <label>Micro asignado<select value={conductorForm.microId ?? ''} onChange={(e) => setConductorForm({ ...conductorForm, microId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin asignar</option>{micros.map((m) => <option key={m.id} value={m.id}>{m.interno} — {m.placa}</option>)}
            </select></label>
            <label className="casilla"><input type="checkbox" checked={conductorForm.activo} onChange={(e) => setConductorForm({ ...conductorForm, activo: e.target.checked })} /> Activo</label>
            <div className="formAcciones"><button className="boton principal" disabled={procesando}>Guardar</button></div>
          </form>
          <div className="tablaWrap">
            <table>
              <thead><tr><th>Conductor</th><th>Cédula</th><th>Micro</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {conductores.map((c) => (
                  <tr key={c.id}><td>{c.nombre} {c.apellido}</td><td>{c.ci}</td><td>{c.microInterno ?? 'Sin asignar'}</td>
                    <td>{c.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="acciones"><button onClick={() => { setConductorEditando(c.id); setConductorForm({ nombre: c.nombre, apellido: c.apellido, ci: c.ci, telefono: c.telefono, microId: c.microId, activo: c.activo }); }}>Editar</button>
                      <button className="peligro" onClick={() => void ejecutar(() => api.eliminarConductor(c.id), 'Conductor eliminado.')}>Eliminar</button></td></tr>
                ))}
                {!conductores.length && <tr><td colSpan={5} className="vacio">No hay conductores registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'tarifas' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => void guardarTarifa(e)}>
            <h3 className="ancho">{tarifaEditando === null ? 'Nueva tarifa autorizada' : `Editar tarifa #${tarifaEditando}`}</h3>
            <label>Línea<select required value={tarifaForm.lineaId} onChange={(e) => setTarifaForm({ ...tarifaForm, lineaId: Number(e.target.value) })}>{lineas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label>
            <label>Categoría<select value={tarifaForm.categoria} onChange={(e) => setTarifaForm({ ...tarifaForm, categoria: e.target.value as Categoria })}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Monto (Bs)<input required type="number" step="0.01" min={0} value={tarifaForm.monto} onChange={(e) => setTarifaForm({ ...tarifaForm, monto: Number(e.target.value) })} /></label>
            <div className="formAcciones"><button className="boton principal" disabled={procesando}>Guardar tarifa</button></div>
          </form>
          <div className="tablaWrap">
            <table>
              <thead><tr><th>Línea</th><th>Categoría</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.id}><td>{lineas.find((l) => l.id === t.lineaId)?.nombre}</td><td>{t.categoria}</td>
                    <td>{Number(t.monto).toFixed(2)} Bs</td><td>{t.activa ? 'Vigente' : 'Inactiva'}</td>
                    <td className="acciones"><button onClick={() => { setTarifaEditando(t.id); setTarifaForm({ lineaId: t.lineaId, categoria: t.categoria, monto: Number(t.monto) }); }}>Editar</button>
                      {t.activa && <button className="peligro" onClick={() => void ejecutar(() => api.eliminarTarifa(t.id), 'Tarifa desactivada.')}>Desactivar</button>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'estudiantes' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => void guardarEstudiante(e)}>
            <h3 className="ancho">Registrar estudiante</h3>
            <label>Nombre<input required maxLength={100} value={estudianteForm.nombre} onChange={(e) => setEstudianteForm({ ...estudianteForm, nombre: e.target.value })} /></label>
            <label>Apellido<input required maxLength={100} value={estudianteForm.apellido} onChange={(e) => setEstudianteForm({ ...estudianteForm, apellido: e.target.value })} /></label>
            <label>Cédula<input required maxLength={30} value={estudianteForm.ci} onChange={(e) => setEstudianteForm({ ...estudianteForm, ci: e.target.value })} /></label>
            <label>Categoría<select value={estudianteForm.categoria} onChange={(e) => setEstudianteForm({ ...estudianteForm, categoria: e.target.value as 'ESCOLAR' | 'UNIVERSITARIO' })}>
              <option value="ESCOLAR">Escolar (RUDE)</option><option value="UNIVERSITARIO">Universitario</option>
            </select></label>
            <label>{estudianteForm.categoria === 'ESCOLAR' ? 'Código RUDE' : 'Código de estudiante'}<input required maxLength={50} value={estudianteForm.codigo} onChange={(e) => setEstudianteForm({ ...estudianteForm, codigo: e.target.value })} /></label>
            <label>Correo institucional<input type="email" placeholder="nombre@upds.edu.bo" value={estudianteForm.correoInstitucional} onChange={(e) => setEstudianteForm({ ...estudianteForm, correoInstitucional: e.target.value })} /></label>
            <label className="ancho">Fotografía de identificación<input type="file" accept="image/*" required onChange={(e) => void leerFoto(e.target.files?.[0]).then((foto) => setEstudianteForm({ ...estudianteForm, fotoUrl: foto }))} /></label>
            <div className="formAcciones"><button className="boton principal" disabled={procesando}>Registrar estudiante</button></div>
          </form>
          <div>
            <div className="tablaWrap">
              <table>
                <thead><tr><th>Estudiante</th><th>Categoría</th><th>Código</th><th>Verificado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {estudiantes.map((e) => (
                    <tr key={e.id}><td>{e.nombre} {e.apellido}</td><td>{e.categoria}</td><td>{e.codigo}</td>
                      <td>{e.verificado ? 'Sí' : 'No'}</td>
                      <td className="acciones">{!e.verificado && <button onClick={() => void ejecutar(() => api.verificarEstudiante(e.id), 'Estudiante verificado.')}>Verificar</button>}
                        <button className="peligro" onClick={() => void ejecutar(() => api.eliminarEstudiante(e.id), 'Estudiante eliminado.')}>Eliminar</button></td></tr>
                  ))}
                  {!estudiantes.length && <tr><td colSpan={5} className="vacio">No hay estudiantes registrados.</td></tr>}
                </tbody>
              </table>
            </div>
            <form className="formulario verificar" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.validarEstudiante(validacion), 'Estudiante válido: tarifa diferenciada autorizada.'); }}>
              <h3 className="ancho">Validar identidad en el punto de abordaje</h3>
              <label>Categoría<select value={validacion.categoria} onChange={(e) => setValidacion({ ...validacion, categoria: e.target.value as 'ESCOLAR' | 'UNIVERSITARIO' })}>
                <option value="ESCOLAR">Escolar</option><option value="UNIVERSITARIO">Universitario</option>
              </select></label>
              <label>Código<input required value={validacion.codigo} onChange={(e) => setValidacion({ ...validacion, codigo: e.target.value })} /></label>
              <label className="ancho">Fotografía (opcional; debe coincidir con la registrada)<input type="file" accept="image/*" onChange={(e) => void leerFoto(e.target.files?.[0]).then((foto) => setValidacion({ ...validacion, fotoUrl: foto }))} /></label>
              <button className="boton secundario" disabled={procesando}>Validar estudiante</button>
            </form>
          </div>
        </div>
      )}

      {pestana === 'reportes' && (
        <div className="formularioSeccion">
          <form className="formulario" onSubmit={(e) => { e.preventDefault(); void cargarSeccion('reportes'); }}>
            <h3 className="ancho">Filtros del reporte</h3>
            <label>Desde<input type="date" value={filtros.desde ?? ''} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value || undefined })} /></label>
            <label>Hasta<input type="date" value={filtros.hasta ?? ''} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value || undefined })} /></label>
            <label>Línea<select value={filtros.lineaId ?? ''} onChange={(e) => setFiltros({ ...filtros, lineaId: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Todas las líneas</option>
              {lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}
            </select></label>
            <div className="formAcciones">
              <button className="boton principal" disabled={procesando}>Aplicar filtros</button>
              <button type="button" className="boton secundario" onClick={() => setFiltros({})}>Limpiar</button>
              <button type="button" className="boton secundario" onClick={() => void ejecutar(() => api.exportarReporte(filtros), 'Reporte CSV descargado.')}>Exportar CSV</button>
            </div>
          </form>
          {reporte && (
            <div className="tarjetas reportes">
              <article className="tarjeta"><span className="sobre">MICROS</span><h3>{reporte.micros.total}</h3><p>Registrados en el sistema</p></article>
              <article className="tarjeta"><span className="sobre">VIAJES ACTIVOS</span><h3>{reporte.viajesActivos}</h3><p>En circulación</p></article>
              <article className="tarjeta"><span className="sobre">PASAJEROS</span><h3>{reporte.pasajerosHoy}</h3><p>Abordajes registrados</p></article>
              <article className="tarjeta"><span className="sobre">PAGOS CONFIRMADOS</span><h3>{reporte.pagos.confirmados}</h3><p>Total: {reporte.pagos.totalBs.toFixed(2)} Bs</p></article>
              <article className="tarjeta"><span className="sobre">TRASBORDOS</span><h3>{reporte.trasbordos}</h3><p>De los cuales {reporte.emergencias} son emergencias</p></article>
              <article className="tarjeta"><span className="sobre">OCUPACIÓN PROMEDIO</span><h3>{reporte.ocupacionPromedio.toFixed(1)}</h3><p>Pasajeros por viaje activo</p></article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
