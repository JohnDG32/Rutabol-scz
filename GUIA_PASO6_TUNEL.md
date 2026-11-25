# Guía — Paso 6: API HTTPS de demostración con túnel (Ruta B)

**Escenario:** backend NestJS en Windows, puerto `3001`; PostgreSQL en Docker en Windows; frontend desplegado en `https://<proyecto>.vercel.app`; API expuesta públicamente mediante un túnel HTTPS de demostración. **No se usa Caddy**: el túnel termina TLS y reenvía el tráfico a `http://localhost:3001`.

> **Seguridad:** en ningún momento se expone el puerto de PostgreSQL (`5432` ni `5433`). El túnel apunta **solo** al `3001`. No crear túneles, reglas de firewall ni variables públicas para la base de datos.

---

## 1. Origen del frontend y CORS HTTP

Archivo: `backend/src/main.ts`.

El origen permitido debe salir siempre de `FRONTEND_ORIGIN`; el valor fijo `https://www.rutabol.test` queda únicamente como respaldo para trabajo local.

```ts
app.setGlobalPrefix('api');
app.enableCors({
  origin: process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
```

`FRONTEND_ORIGIN` debe ser el origen exacto de Vercel: esquema + host (y puerto, si lo hubiera), **sin barra final, sin `/api` y sin comodines**.

```dotenv
FRONTEND_ORIGIN=https://<proyecto>.vercel.app
```

Con `credentials: true`, Nest no debe responder con `Access-Control-Allow-Origin: *`: el navegador rechaza la respuesta cuando la petición lleva cookies. Por eso el valor debe ser explícito y coincidir con el `Origin` enviado por el frontend.

---

## 2. Cookie de sesión para dominios distintos

Archivo: `backend/src/main.ts`. Sustituir la cookie literal actual:

```ts
cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 60 * 60 * 1000 },
```

por una configuración leída del entorno:

```ts
const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none';
const secure = process.env.COOKIE_SECURE === 'true';

if (sameSite === 'none' && !secure) {
  throw new Error('COOKIE_SAMESITE=none requiere COOKIE_SECURE=true');
}

app.use(session({
  name: 'rutabol.sid',
  secret,
  resave: false,
  saveUninitialized: false,
  store: new PgStore({
    pool: database.getPool(),
    createTableIfMissing: true,
  }),
  cookie: { httpOnly: true, sameSite, secure, maxAge: 60 * 60 * 1000 },
}));
```

Para Ruta B, `backend/.env` debe tener:

```dotenv
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

`httpOnly` se mantiene para que JavaScript no pueda leer la cookie, y `maxAge` se mantiene en una hora.

### ¿Por qué `SameSite=None` exige `Secure`?

`None` indica al navegador que envíe la cookie incluso cuando la petición cruza sitios: desde `https://<proyecto>.vercel.app` hacia `https://<tunel>`. Los navegadores solo aceptan esa excepción si la cookie viaja exclusivamente por HTTPS; por eso una cookie `SameSite=None` sin el atributo `Secure` es descartada. Con `SameSite=lax`, en cambio, el login funcionaría en local pero la sesión no se enviaría en las peticiones cross-site de la demo.

---

## 3. `trust proxy`: obligatorio con el túnel

Mantener en `backend/src/main.ts`:

```ts
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

Conviene actualizar el comentario anterior que menciona Caddy, por ejemplo:

```ts
// El túnel HTTPS termina TLS y reenvía HTTP a localhost:3001: Express debe
// confiar en X-Forwarded-Proto para reconocer la petición como segura.
```

El navegador habla HTTPS con el túnel, pero el túnel entrega la petición a Nest por **HTTP** dentro de Windows. Para Express, `req.secure` sería `false` y una cookie con `secure: true` podría no emitirse. Al configurar `trust proxy = 1`, Express confía en la cabecera `X-Forwarded-Proto: https` que añade el túnel y marca correctamente la respuesta como segura. No hace falta exponer HTTPS en el `3001`: la terminación TLS la hace el túnel.

---

## 4. El mismo origen en Socket.IO

Archivo: `backend/src/realtime/realtime.gateway.ts`. El bloque debe quedar así (ya coincide con el estado actual del repo):

```ts
@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test',
    credentials: true,
  },
})
export class RealtimeGateway { /* ... */ }
```

Puntos a respetar:

- `path: '/socket.io'` no se cambia y no lleva el prefijo `/api`.
- `cors.origin` lee **la misma** `FRONTEND_ORIGIN` que el CORS HTTP. Si se dejara fijo `https://www.rutabol.test`, el navegador bloquearía el handshake desde Vercel.
- `credentials: true` es el equivalente en WebSocket del `credentials: true` de `fetch`.
- Tras cambiar `.env`, reiniciar el backend para que el decorador lea el valor nuevo.

---

## 5. Variables sugeridas en `backend/.env`

Valores de plantilla; **no pegar secretos reales en la guía ni en el repositorio**:

```dotenv
PORT=3001
FRONTEND_ORIGIN=https://<proyecto>.vercel.app
COOKIE_SAMESITE=none
COOKIE_SECURE=true
SESSION_SECRET=<valor-aleatorio-de-al-menos-32-caracteres>
DATABASE_URL=postgresql://<usuario>:<password>@localhost:5433/<base>
```

`SESSION_SECRET` debe generarse localmente con un valor aleatorio de al menos 32 caracteres; `main.ts` ya valida esa longitud. Si se usa `5432` en vez de `5433`, tampoco se publica: sigue siendo una conexión local a Docker.

Después de guardar el archivo, detener y arrancar de nuevo la API (por ejemplo, `Ctrl+C` y `npm run start:dev` dentro de `backend`). En Vercel, cambiar `NEXT_PUBLIC_API_URL` exige **redeploy**, porque es una variable pública incorporada durante el build.

---

## 6. Levantar el túnel HTTPS desde Windows

Se trabaja en una terminal de PowerShell separada, con el backend ya escuchando en `http://localhost:3001`.

### Opción A: Cloudflared (recomendada)

Si aún no está instalado:

```powershell
winget install Cloudflare.cloudflared
```

Abrir una terminal nueva y ejecutar:

```powershell
cloudflared tunnel --url http://localhost:3001
```

La salida mostrará líneas parecidas a:

```text
https://abc123-def456.trycloudflare.com
```

Esa es la URL pública. **Mantener la terminal abierta** mientras dure la demostración: al cerrarla o reiniciar el túnel, la URL cambia.

### Opción B: ngrok

```powershell
ngrok http http://localhost:3001
```

Copiar la línea `Forwarding` HTTPS, por ejemplo `https://abc-123.ngrok-free.app -> http://localhost:3001`. Igual que antes, la URL puede cambiar al reiniciar.

En ambos casos el destino es `http://localhost:3001`. No se apunta a PostgreSQL, no se instala Caddy y no se abre el puerto `5432`/`5433` al exterior.

---

## 7. URL pública consumida por el frontend

Con la URL que entregó el túnel, construir la variable del frontend añadiendo `/api` exactamente una vez:

```dotenv
NEXT_PUBLIC_API_URL=https://<URL-del-tunel>/api
```

Ejemplo:

```dotenv
NEXT_PUBLIC_API_URL=https://abc123-def456.trycloudflare.com/api
```

Configurar ese valor en el proyecto de Vercel (**Environment Variables**) y volver a desplegar. No incluir una barra final después de `/api`, porque `frontend/src/lib/api.ts` concatena rutas como `/auth/login`.

---

## 8. Verificación

Sustituir `<URL-del-tunel>`, `<proyecto>` y las credenciales de plantilla por los valores reales de la sesión de prueba.

### 8.1. La API responde detrás del túnel

```powershell
curl.exe -i --ssl-no-revoke "https://<URL-del-tunel>/api/lineas"
```

Se espera HTTP `200` con JSON. `--ssl-no-revoke` evita fallos de validación de revocación propios de curl en Windows; no desactiva HTTPS.

### 8.2. Preflight CORS desde el origen de Vercel

```powershell
curl.exe -i --ssl-no-revoke -X OPTIONS "https://<URL-del-tunel>/api/auth/login" -H "Origin: https://<proyecto>.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

Comprobar:

```text
Access-Control-Allow-Origin: https://<proyecto>.vercel.app
Access-Control-Allow-Credentials: true
```

Si aparece `*` o un host distinto, revisar `FRONTEND_ORIGIN` y reiniciar el backend.

### 8.3. Login y cookie

```powershell
curl.exe -i --ssl-no-revoke -c .\cookies.txt -H "Content-Type: application/json" -H "Origin: https://<proyecto>.vercel.app" -d '{"username":"<usuario>","password":"<contraseña>"}' "https://<URL-del-tunel>/api/auth/login"
```

La respuesta debe incluir una cabecera similar a:

```text
Set-Cookie: rutabol.sid=...; Path=/; HttpOnly; Secure; SameSite=None
```

Verificar la sesión con la cookie guardada:

```powershell
curl.exe -i --ssl-no-revoke -b .\cookies.txt -H "Origin: https://<proyecto>.vercel.app" "https://<URL-del-tunel>/api/auth/me"
```

Se espera HTTP `200` con el usuario. Si no aparece `Set-Cookie`, revisar `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `trust proxy = 1` y que el backend se haya reiniciado.

### 8.4. Prueba final desde Vercel

1. Abrir `https://<proyecto>.vercel.app`.
2. Iniciar sesión con un usuario de demostración.
3. Recargar la página: la sesión debe permanecer (no debe redirigir al login).
4. Abrir las herramientas de desarrollador:
   - en **Network**, las peticiones a `/api/...` deben llegar a la URL del túnel;
   - no debe haber errores de CORS ni de contenido mixto;
   - en **Application → Cookies**, `rutabol.sid` debe figurar con `Secure` y `SameSite=None`;
   - en **Network → WS**, el handshake de `/socket.io` debe responder sin error de CORS.
5. Probar una acción que emitiría el gateway (`cambios`) y comprobar que el panel se actualiza.

---

## 9. Checklist rápido

- [ ] `FRONTEND_ORIGIN` apunta al origen exacto de Vercel, en `main.ts` y en el gateway.
- [ ] `credentials: true` en CORS HTTP y en Socket.IO; `withCredentials`/`credentials: 'include'` en el frontend.
- [ ] `COOKIE_SAMESITE=none` y `COOKIE_SECURE=true` en `backend/.env`.
- [ ] `trust proxy = 1` activo porque el túnel reenvía HTTP a `localhost:3001`.
- [ ] Backend reiniciado; frontend redeployado tras cambiar `NEXT_PUBLIC_API_URL`.
- [ ] Túnel activo y apuntando únicamente a `http://localhost:3001`.
- [ ] **Sin exposición de los puertos `5432` ni `5433` de PostgreSQL.**
