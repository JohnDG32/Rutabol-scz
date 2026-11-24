'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { Usuario } from '@/lib/types';

interface Props {
  usuario: Usuario | null;
  onSesion: (usuario: Usuario | null) => void;
  avisar: (mensaje: string) => void;
}

const roles: Record<string, string> = {
  ADMIN: 'Administrador',
  CONDUCTOR: 'Conductor',
  PASAJERO: 'Pasajero',
  ESTUDIANTE: 'Estudiante',
};

export function Acceso({ usuario, onSesion, avisar }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function ingresar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    setProcesando(true);
    try {
      const datos = await api.login(username, password);
      onSesion(datos);
      setPassword('');
      avisar(`Bienvenido, ${datos.username} (${roles[datos.rol] ?? datos.rol}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible iniciar sesión');
    } finally {
      setProcesando(false);
    }
  }

  async function salir() {
    setError('');
    try {
      await api.logout();
      onSesion(null);
      avisar('Sesión finalizada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cerrar sesión');
    }
  }

  return (
    <section id="acceso" className="seccion accesoSeccion">
      <div>
        <span className="sobre">ACCESO AL SISTEMA</span>
        <h2>Ingreso por rol</h2>
        <p>
          El catálogo y las tarifas son públicos. Para pagos, viajes, trasbordos y administración
          es necesario iniciar sesión con un usuario de demostración.
        </p>
        <p className="nota">
          Usuarios demo: <code>conductor1</code>, <code>pasajero1</code>, <code>estudiante1</code> y{' '}
          <code>admin</code>. Contraseña configurada en <code>backend/.env</code>.
        </p>
      </div>
      {usuario ? (
        <div className="panelAcceso">
          <p>Sesión iniciada: <strong>{usuario.username}</strong></p>
          <span className={`chip rol-${usuario.rol.toLowerCase()}`}>{roles[usuario.rol] ?? usuario.rol}</span>
          <a className="boton principal" href="/dashboard">Ir al dashboard</a>
          <button type="button" className="boton secundario" onClick={() => void salir()}>Cerrar sesión</button>
        </div>
      ) : (
        <form className="panelAcceso" onSubmit={(e) => void ingresar(e)}>
          <label htmlFor="login-usuario">Usuario</label>
          <input id="login-usuario" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <label htmlFor="login-clave">Contraseña</label>
          <input id="login-clave" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="mensajeError" role="alert">{error}</p>}
          <button className="boton principal" type="submit" disabled={procesando}>
            {procesando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      )}
    </section>
  );
}
