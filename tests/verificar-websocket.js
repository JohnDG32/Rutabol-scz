'use strict';

// Prueba del WebSocket por HTTPS (a traves de Caddy). Node 26 trae fetch.
const path = require('path');
const { io } = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'socket.io-client'));

const BASE = process.env.RUTABOL_BASE || 'https://www.rutabol.test';
const API = `${BASE}/api`;
const LAT = -17.7833;
const LNG = -63.1821;

function verificar(nombre, condicion, detalle = '') {
  const estado = condicion ? 'PASS' : 'FAIL';
  console.log(`${estado} : ${nombre}${detalle ? ` ${detalle}` : ''}`);
  return condicion ? 0 : 1;
}

async function main() {
  const resultados = [];
  const micros = await fetch(`${API}/micros`).then((r) => r.json());
  const micro = micros.find((m) => m.interno === '101');
  if (!micro) throw new Error('No se encontro el micro de demostracion 101');

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'conductor1', password: process.env.RUTABOL_DEMO_PASSWORD || 'RutabolDemo123' }),
  });
  if (!login.ok) throw new Error(`Login fallo con HTTP ${login.status}`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  resultados.push(verificar('Login de conductor1 por HTTPS', Boolean(cookie.includes('rutabol.sid='))));

  const socket = io(BASE, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('No se pudo conectar al WebSocket')), 10000);
      socket.once('connect', () => { clearTimeout(t); resolve(); });
      socket.once('connect_error', (error) => { clearTimeout(t); reject(error); });
    });
    resultados.push(verificar('Cliente conectado por /socket.io', socket.connected, `transport=${socket.io.engine.transport.name}`));

    const evento = new Promise((resolve) => {
      const alCambiar = (cambio) => {
        if (cambio.entidad !== 'micros' || cambio.accion !== 'POST') return;
        socket.off('cambios', alCambiar);
        resolve(cambio);
      };
      socket.on('cambios', alCambiar);
    });
    const respuesta = await fetch(`${API}/micros/${micro.id}/posicion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ lat: LAT, lng: LNG, origen: 'GPS_NAVEGADOR' }),
    });
    const posicion = await respuesta.json();
    resultados.push(verificar('La API guardo la posicion', respuesta.ok && posicion.origen === 'GPS_NAVEGADOR', `origen=${posicion.origen}`));

    const cambio = await Promise.race([
      evento,
      new Promise((_, reject) => setTimeout(() => reject(new Error('No llego el evento "cambios"')), 10000)),
    ]);
    resultados.push(verificar('El navegador recibe el cambio en tiempo real', cambio.entidad === 'micros' && cambio.accion === 'POST', `entidad=${cambio.entidad} accion=${cambio.accion}`));
  } finally {
    socket.close();
  }

  const fallos = resultados.filter((r) => r === 1).length;
  console.log('');
  console.log(`TOTAL: ${resultados.length}  PASS: ${resultados.length - fallos}  FAIL: ${fallos}`);
  process.exitCode = fallos > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(`FAIL : ${error.message}`);
  process.exitCode = 1;
});
