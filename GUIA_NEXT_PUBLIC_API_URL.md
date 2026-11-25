# Guía de `NEXT_PUBLIC_API_URL` (Ruta B: frontend en Vercel + API en Windows)

Esta guía explica cómo configurar la única variable de entorno pública que necesita el frontend Next.js de RUTABOL-SCZ para apuntar a la API NestJS cuando se publica en Vercel.

## 1. Contexto de la Ruta B

- El **frontend Next.js** se publica en Vercel, por ejemplo en `https://<proyecto>.vercel.app`.
- La **API NestJS** sigue corriendo en Windows en `http://localhost:3001` y escucha bajo el prefijo global `/api`.
- Como Vercel no puede llamar a `localhost` del equipo, la API se expone mediante un **túnel HTTPS** con una URL pública temporal o estable.
- El navegador del usuario llama directamente a la API pública del túnel, no al servidor de Next.js en Vercel.

Esquema:

```text
Navegador
  │  https://<proyecto>.vercel.app
  ▼
Frontend Next.js en Vercel
  │  fetch(`${NEXT_PUBLIC_API_URL}/auth/login`, { credentials: 'include' })
  ▼
https://<URL_DEL_TUNEL>/api/auth/login
  │  túnel HTTPS
  ▼
API NestJS en Windows: http://localhost:3001/api/auth/login
```

## 2. Qué hace la variable

En `frontend/src/lib/api.ts`, línea 7, está:

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://www.rutabol.test/api';
```

Todas las llamadas del cliente se construyen así:

```ts
fetch(`${BASE}${path}`, {
  cache: 'no-store',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', ...options?.headers },
});
```

Por tanto, `NEXT_PUBLIC_API_URL` es **la URL base de la API**. El valor se concatena con rutas que empiezan con `/`, por ejemplo:

| `path` en `api.ts` | URL final con la Ruta B |
|---|---|
| `/lineas` | `https://<URL_DEL_TUNEL>/api/lineas` |
| `/auth/login` | `https://<URL_DEL_TUNEL>/api/auth/login` |
| `/auth/me` | `https://<URL_DEL_TUNEL>/api/auth/me` |
| `/micros/cercanos?lat=...` | `https://<URL_DEL_TUNEL>/api/micros/cercanos?lat=...` |

El prefijo `NEXT_PUBLIC_` indica que Next.js puede exponer ese valor al código del navegador. Es una variable **pública**: aparece en el JavaScript descargado por el usuario. Nunca pongas aquí contraseñas, `SESSION_SECRET`, claves de Stripe ni ningún otro secreto. Los secretos del backend permanecen en `backend/.env` del equipo Windows.

## 3. Sustitución en tiempo de compilación

Next.js **sustituye las variables `NEXT_PUBLIC_*` durante el build**, no las lee en tiempo de ejecución desde el navegador.

Esto significa que:

1. Al ejecutar `npm run build` (o el build automático de Vercel), Next.js toma el valor de `NEXT_PUBLIC_API_URL` presente en ese momento.
2. El valor queda escrito literalmente en los archivos JavaScript de `.next/static/chunks`.
3. El bundle resultante se sube a Vercel y se sirve a los visitantes.
4. Cambiar la variable en la interfaz de Vercel **no reescribe automáticamente un deployment ya construido**: hay que generar un nuevo build.

Consecuencia práctica: **cada cambio de esta variable requiere redesplegar** el frontend. Recargar el navegador, borrar la caché o reiniciar el túnel no actualiza el valor incrustado en un bundle antiguo.

> En desarrollo con `npm run dev`, Next.js relee el entorno al iniciar el servidor. Tras editar `frontend/.env.local`, detén y vuelve a iniciar el servidor para evitar dudas.

## 4. Valor por defecto

Si la variable no existe, se usa este valor literal:

```dotenv
https://www.rutabol.test/api
```

Ese dominio es el nombre local del entorno de demostración con Caddy y certificado `mkcert`. Funciona en la máquina Windows donde están configurados el archivo `hosts` y el proxy local, pero **no es una URL pública**: desde Vercel o desde el navegador de otra persona no resolverá `www.rutabol.test`.

Por eso el valor por defecto es útil como red de seguridad en el laboratorio local, pero **no sustituye la configuración explícita en Vercel**.

## 5. Valores según el entorno

### 5.1. Local con `npm run dev`

Cuando el frontend se ejecuta en la misma máquina Windows que NestJS, la API es alcanzable directamente por `localhost`. En `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Es HTTP porque es una comunicación local dentro del mismo equipo; no hay problema de contenido mixto. El puerto `3001` es el de NestJS y `/api` es el prefijo global configurado en `backend/src/main.ts`.

Si en cambio estás probando localmente el entorno completo con Caddy (`https://www.rutabol.test`), usa:

```dotenv
NEXT_PUBLIC_API_URL=https://www.rutabol.test/api
```

No mezcles ambos enfoques en el mismo arranque: elige la URL que corresponda a la forma en que estás abriendo el frontend.

### 5.2. Vercel con la Ruta B

En Vercel, el valor debe ser la URL pública HTTPS del túnel más el prefijo `/api`:

```dotenv
NEXT_PUBLIC_API_URL=https://<URL_DEL_TUNEL>/api
```

Ejemplo con marcadores de posición, sin datos reales:

```dotenv
NEXT_PUBLIC_API_URL=https://tunel-ejemplo.tld/api
```

Reglas para el valor:

- Debe empezar con `https://`. Usar `http://` desde una página HTTPS de Vercel produce contenido mixto y el navegador bloquea la petición.
- Debe terminar exactamente en `/api`, sin barra final adicional: `https://<URL_DEL_TUNEL>/api/`.
- No incluir un endpoint concreto: **no** `https://<URL_DEL_TUNEL>/api/lineas`.
- No incluir saltos de línea ni caracteres ocultos como un `\n` literal. Un valor mal copiado genera rutas tipo `/api/n/lineas`.
- No añadir credenciales, tokens ni parámetros de consulta a la URL.
- Si el túnel cambia de dominio, hay que actualizar la variable y redesplegar.

## 6. Cómo configurarla en Vercel

1. Entrar al proyecto de Vercel.
2. Ir a **Settings → Environment Variables**.
3. Hacer clic en **Add New**.
4. Completar:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://<URL_DEL_TUNEL>/api`
5. Marcar los tres entornos:
   - **Production**
   - **Preview**
   - **Development**
6. Guardar el cambio.
7. Ir a **Deployments** y ejecutar **Redeploy** del deployment vigente, o bien hacer un nuevo commit/push que dispare un build nuevo.

Cómo interpretar los entornos:

| Entorno de Vercel | Para qué sirve | Valor recomendado en Ruta B |
|---|---|---|
| Production | Deployment principal del proyecto | `https://<URL_DEL_TUNEL>/api` |
| Preview | Deployments de ramas y pull requests | El mismo túnel, si es compartido |
| Development | Desarrollo mediante herramientas de Vercel (`vercel dev`) | El mismo túnel, o la URL local si el backend se ejecuta en esa máquina |

Si ejecutas `npm run dev` directamente en Windows, Next.js usa `frontend/.env.local`; las variables de Development de Vercel no sustituyen automáticamente ese archivo. Para (`vercel dev`) se aplican las variables de Vercel.

Esta variable no contiene secretos, así que puede configurarse directamente en la interfaz. No hace falta marcarla como sensible ni ocultarla. Aun así, nunca pegues en el valor una URL con credenciales incrustadas.

## 7. Por qué hay que redesplegar

El código compilado no contiene la expresión original, sino el valor resuelto:

```js
// Resultado aproximado en el bundle de Vercel
const BASE = "https://<URL_DEL_TUNEL>/api";
```

Si se cambia la variable después del build, el JavaScript que ya está publicado sigue teniendo la URL anterior. Vercel no reconstruye despliegues antiguos solo porque cambió una variable. El procedimiento correcto es:

```text
Cambiar variable → Guardar → Redeploy → Verificar el bundle → Probar en el navegador
```

Lo mismo aplica si el proveedor del túnel cambia la URL: actualiza `NEXT_PUBLIC_API_URL` y vuelve a desplegar.

## 8. Cómo verificar el valor

### 8.1. En el bundle de producción

Después del build local:

```powershell
cd frontend
npm run build
Select-String -Path .\.next\static\chunks\*.js -Pattern 'localhost:3001','rutabol.test','<URL_DEL_TUNEL>' -SimpleMatch
```

También puedes buscar directamente en el JavaScript servido por Vercel:

1. Abrir `https://<proyecto>.vercel.app`.
2. Abrir DevTools (`F12`) → **Sources**.
3. Buscar en los archivos bajo `_next/static/chunks` el texto `/api` o el dominio del túnel.
4. Confirmar que aparece `https://<URL_DEL_TUNEL>/api` y no `localhost:3001` ni `https://www.rutabol.test/api`.

Un resultado con `localhost:3001` en un bundle de Vercel significa que se construyó con `frontend/.env.local` o que no se redesplegó tras el cambio.

### 8.2. En el navegador

1. Abrir `https://<proyecto>.vercel.app`.
2. DevTools (`F12`) → pestaña **Network** → filtrar **Fetch/XHR**.
3. Recargar y revisar una llamada real, por ejemplo `lineas` o `auth/me`.
4. Comprobar:
   - El dominio de la petición es el del túnel HTTPS.
   - La ruta empieza con `/api/`.
   - El estado HTTP es el esperado (`200` en consultas públicas).
   - En **Headers → Request Headers**, el navegador no genera un error de CORS.
   - Tras iniciar sesión, las peticiones autenticadas envían la cookie; en **Application → Cookies** debe aparecer la cookie del dominio de la API.

Prueba mínima de API, cambiando solo el marcador del túnel:

```powershell
curl.exe -i https://<URL_DEL_TUNEL>/api/lineas
```

Si esta llamada falla, el problema está en el túnel o en NestJS, no en `NEXT_PUBLIC_API_URL`.

## 9. Relación con CORS, `FRONTEND_ORIGIN` y cookies cross-site

La URL correcta no basta para que la sesión funcione. En Ruta B, el frontend y la API están en **orígenes distintos**:

```text
Frontend: https://<proyecto>.vercel.app
API:      https://<URL_DEL_TUNEL>
```

El frontend ya envía:

```ts
credentials: 'include'
```

Eso le pide al navegador que adjunte cookies en la petición cross-site, pero el navegador solo lo hará si se cumplen todas estas condiciones:

1. **CORS explícito en el backend.** `backend/src/main.ts` usa:

   ```ts
   app.enableCors({
     origin: process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test',
     credentials: true,
     methods: ['GET', 'POST', 'PATCH', 'DELETE'],
   });
   ```

   Por eso, en el equipo Windows donde corre la API, `backend/.env` debe definir exactamente el origen del frontend publicado:

   ```dotenv
   FRONTEND_ORIGIN=https://<proyecto>.vercel.app
   ```

   Debe coincidir con el origen real, incluido `https://` y sin barra final ni `/api`. Un `*` como origen no es válido cuando se usa `credentials: true`.

   Si el valor sigue siendo `https://www.rutabol.test`, el navegador rechazará las respuestas de la API por CORS aunque `NEXT_PUBLIC_API_URL` apunte al túnel correcto. Para preview deployments con dominios distintos, el backend debe autorizar el origen correspondiente.

2. **Cookie adecuada para cross-site.** El código actual de sesión usa:

   ```ts
   cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 60 * 60 * 1000 }
   ```

   Esa configuración está pensada para el entorno local donde web y API comparten el mismo sitio (`www.rutabol.test`) detrás de Caddy. Con Vercel y un túnel en otro dominio, la petición es cross-site: para que la cookie de sesión se envíe en `fetch` con `credentials: 'include'`, la política debe revisarse y usar, en el backend, algo equivalente a:

   ```ts
   cookie: { httpOnly: true, sameSite: 'none', secure: true, maxAge: 60 * 60 * 1000 }
   ```

   `SameSite=None` permite el envío cross-site y `Secure` es obligatorio con HTTPS. La configuración del método de logout también debe ser coherente para borrar la misma cookie. Este ajuste es un cambio de backend; esta guía solo documenta la variable del frontend y no modifica el código.

3. **Túnel HTTPS estable.** La cookie se marca como `Secure`, por lo que la API debe ser accesible por HTTPS. Si el túnel cambia de dominio o se cierra, cambia también la URL base que debe tener el bundle.

4. **Política del navegador.** Algunos navegadores limitan o bloquean cookies de terceros. Si la sesión cross-site falla pese a CORS y a `SameSite=None; Secure`, revisa la configuración de cookies del navegador o plantéate un dominio propio común para web y API.

Resumen: `NEXT_PUBLIC_API_URL` responde **a dónde llama** el frontend; `FRONTEND_ORIGIN` y la política de cookies responden **si el navegador permite y envía la sesión** en esa llamada. Las tres piezas deben estar alineadas.

## 10. Errores típicos

| Síntoma | Causa probable | Corrección |
|---|---|---|
| `Cannot GET /api/n/lineas` | Se copió un salto de línea literal o un carácter extra al final de la variable | Revisar el valor y dejarlo exactamente como `https://<URL_DEL_TUNEL>/api`; redesplegar |
| Peticiones a `http://localhost:3001/api/...` desde Vercel | El bundle se construyó con `frontend/.env.local` o no se redesplegó | Configurar la variable en Vercel y crear un deployment nuevo |
| Bloqueo por contenido mixto | La variable usa `http://` siendo la página `https://` | Usar `https://<URL_DEL_TUNEL>/api` |
| Error de CORS: `No 'Access-Control-Allow-Origin' header...` | `FRONTEND_ORIGIN` no coincide con el origen de Vercel, o el backend no tiene `credentials: true` | Definir `FRONTEND_ORIGIN=https://<proyecto>.vercel.app` en `backend/.env`, reiniciar NestJS y comprobar CORS |
| La petición llega al backend pero `auth/me` devuelve `401` tras el login | La cookie cross-site no se está enviando; revisar `SameSite`, `Secure` y bloqueo de cookies de terceros | Ajustar la política de cookies del backend para `SameSite=None; Secure` y verificar en DevTools → Application → Cookies |
| `Cannot GET /lineas` o `404` en la API | Falta el prefijo `/api` en la URL base | Añadir `/api` al final de `NEXT_PUBLIC_API_URL` y redesplegar |
| Doble barra, por ejemplo `/api//lineas` | La variable termina con `/` y el `path` ya empieza con `/` | Quitar la barra final de la URL base |
| Dominio `www.rutabol.test` no resuelve en Vercel | Se está usando el valor por defecto del código | Definir explícitamente `NEXT_PUBLIC_API_URL` en Vercel |
| El túnel cambió de URL y dejaron de funcionar las peticiones | El bundle tiene incrustada la URL antigua | Actualizar la variable en Vercel y redesplegar |

## 11. Checklist para la Ruta B

- [ ] NestJS escucha en `http://localhost:3001` y responde localmente `http://localhost:3001/api/lineas`.
- [ ] El túnel HTTPS publica la API y `https://<URL_DEL_TUNEL>/api/lineas` responde `200`.
- [ ] `frontend/.env.local` usa `http://localhost:3001/api` para desarrollo local directo.
- [ ] Vercel tiene `NEXT_PUBLIC_API_URL=https://<URL_DEL_TUNEL>/api` en Production, Preview y Development.
- [ ] No se pegaron secretos ni credenciales en la variable.
- [ ] Se hizo un nuevo deployment después de guardar la variable.
- [ ] El bundle de Vercel contiene la URL del túnel y no `localhost` ni `www.rutabol.test`.
- [ ] DevTools muestra las peticiones a `https://<URL_DEL_TUNEL>/api/...`.
- [ ] `backend/.env` define `FRONTEND_ORIGIN=https://<proyecto>.vercel.app` y NestJS se reinició.
- [ ] La política de cookies del backend permite el uso cross-site con HTTPS.
