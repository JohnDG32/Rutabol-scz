# RUTABOL-SCZ

**Tecnología Web I · Ingeniería de Sistemas · Actividad 01**

Sistema web para mejorar el control, la seguridad, la organización y la transparencia del transporte público de micros en Santa Cruz de la Sierra. Implementa los 24 requerimientos funcionales y 18 no funcionales documentados en [`REQUERIMIENTOS.md`](REQUERIMIENTOS.md).

> Proyecto académico con datos ficticios. GPS y pasarela de pagos son simulados; las fotografías son de demostración y se almacenan fuera de la base de datos. No representa operación oficial.

> **¿Querés correrlo desde cero?** Seguí el [`MANUAL.md`](MANUAL.md), paso a paso y sin omitir nada.

## Tecnologías

- **Frontend:** Next.js 15 + React 19 + TypeScript.
- **Backend:** NestJS 11 + TypeScript + `class-validator`, `bcryptjs`, `express-session` con `connect-pg-simple`.
- **Base de datos:** PostgreSQL 17 en Docker Compose.
- **Infraestructura local:** DNS BIND9 opcional (ver `README-DNS.md`) y Caddy 2 como proxy inverso con HTTPS local.
- **Certificados:** generados con `mkcert`; la autoridad local queda instalada en la computadora y los archivos de `certs/` no se versionan.

## Puesta en marcha

### 0. Nombre de la página y HTTPS

La aplicación se abre en **https://www.rutabol.test** y la API en **https://www.rutabol.test/api** (sin puertos). Caddy escucha en 80/443 y redirige HTTP → HTTPS; por dentro reenvía a Next.js (:3000) y a NestJS (:3001). Internamente esos servicios siguen en HTTP, así que el arranque habitual no cambia.

Para que Windows resuelva el nombre, agregue una línea al archivo `C:\Windows\System32\drivers\etc\hosts` **desde un PowerShell como Administrador**:

```powershell
Add-Content C:\Windows\System32\drivers\etc\hosts "`n127.0.0.1  www.rutabol.test  api.rutabol.test"
```

El DNS BIND de `dns/` ya publica la zona `rutabol.test` (registros A `www` y `api` → `127.0.0.1`), pero el navegador no la consulta a menos que se cambie el resolvedor del sistema. El archivo `hosts` es la forma más simple de probar sin modificar la configuración de red. Ver [`README-DNS.md`](README-DNS.md).

El certificado de `certs/` fue creado con `mkcert` para `www.rutabol.test`, `api.rutabol.test`, `localhost` y `127.0.0.1`. Si necesita regenerarlo:

```powershell
mkcert -install
mkcert -cert-file certs\rutabol.test.pem -key-file certs\rutabol.test-key.pem www.rutabol.test api.rutabol.test localhost 127.0.0.1 ::1
docker compose restart caddy
```

La cookie `rutabol.sid` usa `secure: 'auto'`: se marca `Secure` cuando la petición entra por HTTPS (proxy) y permanece normal si se accede directamente por HTTP al puerto 3001. Así se pueden seguir corriendo las pruebas locales contra `http://localhost:3001/api`.

### 1. Base de datos

Desde la raíz del repositorio:

```powershell
docker compose up -d
docker compose ps
```

Si el volumen `postgres_data` viene de una versión anterior del proyecto (incluida la que no tenía `posiciones.origen`), aplique la migración idempotente una sola vez:

```powershell
docker compose exec -T postgres psql -U micros -d micros_scz -f /rutabol-migration.sql
```

En una instalación nueva, `01_init.sql` y `02_migracion_rutabol.sql` se ejecutan automáticamente al crear el volumen.

### 2. API

```powershell
cd backend
npm install
npm run start:dev
```

Escucha internamente en `http://localhost:3001/api` y se publica como `https://www.rutabol.test/api`. El archivo `backend/.env` debe contener:

```dotenv
PORT=3001
FRONTEND_ORIGIN=https://www.rutabol.test
DATABASE_URL=postgresql://micros:<PASSWORD>@localhost:5433/micros_scz
SESSION_SECRET=<secreto-de-al-menos-32-caracteres>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<clave-de-al-menos-12-caracteres>
RUTABOL_DEMO_PASSWORD=RutabolDemo123
```

> La contraseña de PostgreSQL debe coincidir con `POSTGRES_PASSWORD` del `.env` de la raíz.

### 3. Web

```powershell
cd frontend
npm install
npm run dev
```

Visite **https://www.rutabol.test**. La URL de la API se configura en `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=https://www.rutabol.test/api
```

## Usuarios de demostración

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin` | ADMIN | la de `ADMIN_PASSWORD` |
| `conductor1` | CONDUCTOR | `RUTABOL_DEMO_PASSWORD` |
| `pasajero1` | PASAJERO | `RUTABOL_DEMO_PASSWORD` |
| `estudiante1` | ESTUDIANTE | `RUTABOL_DEMO_PASSWORD` |

Los usuarios de demostración se crean automáticamente al iniciar la API y se asocian a un conductor con micro asignado y a un estudiante universitario verificado.

## Estructura

```text
backend/src/
  auth/           login, sesión y roles
  common/         RolesGuard, auditoría
  lineas/         catálogo de líneas (CRUD ADMIN)
  micros/         micros, disponibilidad y GPS
  conductores/    conductores y micro asignado
  tarifas/        tarifas autorizadas por línea y categoría
  estudiantes/    RUDE, código universitario, foto y verificación
  pagos/          pasarela simulada y confirmación
  viajes/         abordajes, capacidad, trasbordos y emergencias
  notificaciones/ avisos a pasajeros, conductores y administrador
  reportes/       estadísticas
  usuarios/       CRUD de usuarios, roles y estado (ADMIN)
frontend/src/
  app/            página principal, /dashboard y estilos
  components/     Acceso, Consultas, PanelConductor, PanelPasajero, PanelAdmin
  lib/            api.ts (cliente HTTP) y types.ts
database/         01_init.sql y migraciones 02 a 05
```

## Flujo básico de prueba

1. Ingrese como **admin** y registre/ autorice un micro (capacidad entre 18 y 25).
2. Como **conductor1**, inicie un viaje y envíe una posición GPS. En "Actualizar GPS" puede presionar **Usar mi ubicación real** (navegador con HTTPS) o escribir latitud/longitud a mano.
3. Como **pasajero1**, consulte el micro cercano, cree un pago y confírmelo.
4. El conductor registra el abordaje con el ID del pago confirmado; al superar la capacidad se bloquea y se genera una alerta.
5. El conductor realiza un trasbordo con el mismo `pago_id` o activa una emergencia; los pasajeros reciben notificaciones.
6. El admin revisa el historial, las tarifas y el reporte estadístico.

## Endpoints principales

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/lineas`, `/api/micros`, `/api/tarifas` | Público |
| GET | `/api/micros/cercanos?lat=&lng=&radio=5` | Público |
| POST | `/api/auth/login`, `/api/auth/logout` | Público |
| GET | `/api/auth/me` | Sesión iniciada |
| GET/POST/PATCH/DELETE | `/api/usuarios` y `/api/usuarios/:id` | ADMIN |
| POST/PATCH/DELETE | `/api/lineas`, `/api/micros`, `/api/conductores`, `/api/tarifas`, `/api/estudiantes` | ADMIN |
| POST | `/api/micros/:id/posicion` | CONDUCTOR, ADMIN |
| POST | `/api/pagos`, `/api/pagos/:id/confirmar` | Sesión iniciada |
| GET | `/api/viajes/historial`, `/api/pagos/mios`, `/api/notificaciones` | Sesión iniciada |
| POST | `/api/viajes`, `/api/viajes/:id/{abordar,bajar,finalizar,trasbordo,emergencia}` | CONDUCTOR, ADMIN |
| GET | `/api/reportes/resumen?desde=&hasta=&lineaId=` | ADMIN |
| GET | `/api/reportes/exportar?desde=&hasta=&lineaId=` | ADMIN (CSV) |

## GPS real del navegador

La geolocalización nativa (`navigator.geolocation`) solo funciona en un contexto seguro: abra siempre **https://www.rutabol.test** y acepte el permiso del navegador.

- **Pasajero:** el botón *Buscar con mi ubicación* usa las coordenadas reales para la consulta de micros cercanos. Si el GPS falla o se deniega, se muestra el aviso y se usa la ubicación de demostración; también existe el botón *Usar ubicación de demostración*.
- **Conductor:** en *Actualizar GPS*, el botón *Usar mi ubicación real* completa latitud/longitud y muestra la precisión aproximada en metros; luego presiona *Enviar posición*. Las coordenadas siguen siendo editables a mano.
- Cada posición se guarda con `origen`: `SIMULADO` (valor por defecto de la API), `MANUAL` (coordenadas escritas en el panel) o `GPS_NAVEGADOR` (dispositivo real). La lista de micros cercanos muestra la etiqueta **GPS real** cuando corresponde.

Las posiciones de demostración siguen siendo simuladas; este cambio agrega la opción de usar la ubicación real sin quitar el modo demo.

Listado completo y trazabilidad RF/RNF/RN: [`REQUERIMIENTOS.md`](REQUERIMIENTOS.md).

## Actualización en tiempo real

Después de cada operación de escritura correcta (`POST`/`PATCH`/`PUT`/`DELETE`), el interceptor de auditoría emite un evento `cambios` por **Socket.IO** (`backend/src/realtime/`). Los navegadores conectados recargan el catálogo, los viajes, las notificaciones y la lista de micros cercanos al instante.

- Caddy redirige `/socket.io/*` hacia la API en el mismo `https://www.rutabol.test`, así que no hay que abrir puertos ni configurar otra URL.
- El cliente (`frontend/src/lib/socket.ts`) usa el mismo origen, reintenta la conexión y baja a polling HTTP si el WebSocket no está disponible.
- Se conserva **polling cada 60 segundos** como respaldo (antes era cada 10 s). Es decir: WebSocket para inmediatez, polling para resiliencia.

## Extra: mapa callejero real

La sección *Micros cercanos* muestra un mapa **Leaflet + OpenStreetMap** con el radio de búsqueda de 5 km, un marcador por micro (con color de su línea) y un popup con placa, línea, distancia y origen de la posición. Al consultar, el mapa se ajusta automáticamente a la ubicación y a los micros encontrados.

- El botón **Mapa esquemático** permite volver a la vista anterior, que funciona sin conexión.
- Si fallan las teselas (por ejemplo, sin internet), aparece un aviso con acceso directo al mapa esquemático.
- Leaflet se importa de forma dinámica dentro de un cliente de Next.js, por lo que no interfiere con el renderizado del servidor.
- Las teselas se sirven desde OpenStreetMap; se muestra su atribución en el mapa, como exige su licencia.

## Extra: fotografías fuera de la base de datos

Las fotos de identificación de los estudiantes ya no se guardan como `data:image/...` dentro de PostgreSQL. El frontend sigue seleccionando un archivo y convirtiéndolo en data URL, pero la API la decodifica y la escribe en `backend/uploads/fotos/`; en la tabla `estudiantes.foto_url` queda solo una ruta como `/uploads/fotos/estudiante-1-<hash>.png`.

- Caddy publica `/uploads/*` y `express.static` sirve los archivos desde disco. El directorio está ignorado por Git.
- Al arrancar, `FotoService` migra automáticamente cualquier data URL antigua a un archivo y actualiza la fila.
- Límite de 2 MB; se aceptan PNG, JPEG, WebP y GIF. El nombre usa un hash SHA-256 del contenido, así que subidas repetidas no duplican archivos.
- La validación de tarifa compara los bytes de la foto enviada con la guardada, tanto si la BD tiene una URL de archivo como si conserva una data URL vieja.
- Al editar o eliminar un estudiante se borra el archivo que dejó de usarse.
- El panel de administración muestra una miniatura de la foto en la pestaña *estudiantes*.

## Extra: pasarela Stripe en modo de prueba

La pasarela simulada sigue siendo el **modo por defecto** y no necesita internet. Stripe se activa solo si se configuran variables de entorno; nunca se usa una clave real ni se almacenan datos de tarjeta.

```dotenv
PAGOS_MODO=STRIPE
STRIPE_SECRET_KEY=sk_test_...
STRIPE_MONEDA=usd
STRIPE_TIPO_CAMBIO=1
# Opcional, solo con un túnel público:
STRIPE_WEBHOOK_SECRET=whsec_...
```

- `STRIPE_MONEDA` es la moneda enviada a Checkout. Stripe no publica un importe mínimo para `BOB`, así que la demo usa `usd` por defecto; `STRIPE_TIPO_CAMBIO` convierte el importe en Bs al número presentado en la pasarela (es solo informativo, no es un tipo de cambio real).
- `GET /api/pagos/config` devuelve `{ "modo": "SIMULADO" | "STRIPE", "moneda": "usd" }` y el panel del pasajero muestra el botón correspondiente. En modo STRIPE se oculta el token simulado.
- `POST /api/pagos/:id/checkout` crea una Checkout Session y guarda su id en `pagos.stripe_sesion_id`. `POST /api/pagos/:id/confirmar-stripe` consulta el estado real en Stripe antes de marcar el pago. El endpoint antiguo `POST /api/pagos/:id/confirmar` sigue funcionando solo para pagos simulados.
- La URL de éxito por defecto conserva `{CHECKOUT_SESSION_ID}`; al volver, el frontend confirma el pago automáticamente. La URL de cancelación vuelve al panel sin cambiar el estado.
- `POST /api/pagos/webhook` acepta `checkout.session.completed` y `checkout.session.expired` con firma verificada. Es **opcional**: `www.rutabol.test` usa un certificado mkcert local, así que Stripe no puede llamarlo; para usarlo hace falta un túnel público (por ejemplo, `stripe listen`).
- La base acepta `pagos.metodo = 'STRIPE'` y la columna `stripe_sesion_id`. En instalaciones existentes se aplica `database/03_migracion_stripe.sql`; en las nuevas ya viene en `01_init.sql`.

Verificación del cableado (usa una clave `sk_test_` inválida en una API aislada, sin tocar la instancia principal):

```powershell
powershell -ExecutionPolicy Bypass -File tests/verificar-stripe.ps1
```

### Estado para producción de Stripe (pendiente de credenciales)

El proyecto se entrega con `PAGOS_MODO=SIMULADO`. No se incluyen claves reales ni datos de tarjeta. Para pasar a Stripe en una instalación real hace falta una clave de prueba propia (`sk_test_...`) o, en su momento, una clave de producción; en ambos casos se carga en `backend\.env`, nunca en el repositorio.

El **webhook es opcional** y hoy está sin configurar por diseño: la confirmación del pago ocurre al volver de Checkout con `session_id`, así que el flujo completo funciona sin él. `www.rutabol.test` usa un certificado mkcert local, al que Stripe no puede llamar. Para activar el webhook hacen falta dos cosas:

1. Un túnel público hacia la API, por ejemplo `stripe listen --forward-to localhost:3001/api/pagos/webhook` (o un dominio HTTPS público con Caddy).
2. El secreto del webhook (`whsec_...`) en `STRIPE_WEBHOOK_SECRET`.

Sin esos dos pasos, `POST /api/pagos/webhook` existe pero no recibe eventos; no es un fallo, es una decisión de diseño para la demo.

## Extra: notificaciones externas (push y correo)

Los avisos internos del panel siguen funcionando igual sin configuración. Este extra permite además enviarlos al navegador (Web Push) y por correo, de forma **opcional** y sin credenciales reales.

```dotenv
# Generá las claves con: npx web-push generate-vapid-keys (dentro de backend)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:demo@rutabol.test
# Modo de correo: DESACTIVADO (default), ARCHIVO o SMTP
NOTIFICACIONES_EMAIL_MODO=ARCHIVO
NOTIFICACIONES_EMAIL_DESTINO=demo@rutabol.test
# Solo para SMTP:
# SMTP_HOST=...
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=...
# SMTP_PASSWORD=...
```

- Sin claves VAPID, `GET /api/notificaciones/config` devuelve `{ "push": false, "correo": "DESACTIVADO" }` y el panel no muestra los botones de push. La demo queda idéntica a la versión base.
- Con VAPID configurado, las rutas `POST /api/notificaciones/suscribir` y `/desuscribir` guardan o borran la suscripción del navegador en la tabla `suscripciones_push`.
- `POST /api/notificaciones/prueba` crea un aviso real (tipo `PRUEBA`) y dispara el envío externo; sirve para probar sin provocar una emergencia.
- El envío es **best-effort**: si un push falla (endpoint caído), se registra un aviso en el log y se limpia la suscripción inválida, pero el aviso interno y la operación principal nunca se rompen.
- `ARCHIVO` escribe los correos como `.eml` en `backend/uploads/correos/` (ignorado por Git). `SMTP` usa el servidor configurado. Para bases existentes se aplica `database/04_migracion_notificaciones.sql`; en las nuevas ya viene en `01_init.sql`.

Verificación (usa claves VAPID de prueba en una API aislada, sin tocar la instancia principal):

```powershell
powershell -ExecutionPolicy Bypass -File tests/verificar-notificaciones.ps1
```

### Estado para producción de notificaciones (pendiente de credenciales)

La configuración entregada es deliberadamente no invasiva:

| Canal | Estado por defecto | Qué falta para usarlo de verdad |
|---|---|---|
| Avisos internos en el panel | Activo | Nada; es la base de la Actividad 01. |
| Correo `ARCHIVO` | Disponible si se elige | Nada; escribe `.eml` en `backend/uploads/correos/`. |
| Correo `SMTP` | `DESACTIVADO` | Host, puerto, usuario y contraseña de un servidor SMTP real, además del destinatario. |
| Web Push | `DESACTIVADO` | Par de claves VAPID propio (`npx web-push generate-vapid-keys`) y un dominio HTTPS público. |

Sin claves VAPID, `/api/notificaciones/config` responde `{ "push": false, "correo": "DESACTIVADO" }` y el panel no ofrece botones de push. Con `NOTIFICACIONES_EMAIL_MODO=DESACTIVADO` (valor por defecto) no se escribe ningún `.eml`. Las claves VAPID de prueba que usa `verificar-notificaciones.ps1` son efímeras, están solo en esa prueba y no se guardan en `.env`.

Para producción: generar las claves VAPID propias, cargarlas en `backend\.env` junto con `VAPID_SUBJECT=mailto:...`, elegir `ARCHIVO` o `SMTP`, reiniciar la API y verificar con `/api/notificaciones/config`. Ninguna credencial real está versionada: `backend\.env` y `certs/` están ignorados por Git.

## Dashboard con login y gestión de usuarios

La ruta **`/dashboard`** muestra un panel posterior al login con tarjetas distintas para `ADMIN`, `CONDUCTOR`, `PASAJERO` y `ESTUDIANTE`. Cada tarjeta enlaza al panel que corresponde dentro de la página principal. Después del login aparece un botón **Ir al dashboard** en el panel de acceso. Si no hay sesión, el dashboard invita a iniciar sesión. La separación la hace el servidor, no el frontend: `RolesGuard` consulta `rol` y `activo` en PostgreSQL en cada petición protegida.

- `GET /api/usuarios` devuelve `{ id, username, rol, activo }` para ADMIN. **Nunca** devuelve `password_hash`.
- `POST /api/usuarios` crea un usuario con `username`, `password` (mínimo 12 caracteres), `rol` y `activo` opcional. La clave se hashea con bcrypt (12 rondas) mediante `bcryptjs`.
- `PATCH /api/usuarios/:id` edita usuario, rol, estado y, opcionalmente, la clave. Un campo `password` vacío se omite y conserva la clave anterior.
- `DELETE /api/usuarios/:id` hace **baja lógica** (`activo = false`); no borra la fila para preservar las relaciones históricas.
- Reglas de seguridad: un administrador no puede desactivarse ni cambiar su propio rol desde el CRUD, y no se puede dejar la instalación sin un administrador activo.
- Un usuario inactivo no puede iniciar sesión y pierde de inmediato el acceso a los endpoints protegidos aunque su cookie siga viva. Los cambios de rol también surten efecto sin esperar a que expire la sesión.

Para instalaciones con volumen de PostgreSQL ya creado, aplicar la migración:

```powershell
docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 -f /usuarios-migration.sql
```

El archivo `database/05_migracion_usuarios.sql` agrega `usuarios.activo BOOLEAN NOT NULL DEFAULT TRUE`. En instalaciones nuevas `01_init.sql` ya lo incluye. No se creó una tabla nueva: `verificar-restore.ps1` sigue comparando las mismas 14 tablas.

Verificación aislada (14 comprobaciones, puerto 3013, limpia al terminar):

```powershell
powershell -ExecutionPolicy Bypass -File tests/verificar-usuarios.ps1
```

## Copias de seguridad

```powershell
docker compose exec -T postgres pg_dump -U micros -d micros_scz -f /tmp/backup_rutabol.sql
docker compose cp postgres:/tmp/backup_rutabol.sql ./backup_rutabol.sql
docker compose exec -T postgres sh -c "rm -f /tmp/backup_rutabol.sql"
```

Para restaurar, copie el archivo al contenedor y aplíquelo **sobre una base vacía**:

```powershell
docker compose cp ./backup_rutabol.sql postgres:/tmp/backup_rutabol.sql
docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 -f /tmp/backup_rutabol.sql
```

## Verificación de compilación

```powershell
cd backend; npm run build
cd ../frontend; npm run build
```

Ambos comandos pasan en la versión entregada. La prueba de ejecución con PostgreSQL requiere Docker Desktop en funcionamiento.

> **No ejecute `npm run build` en el frontend mientras `npm run dev` esté activo**: ambos usan la carpeta `.next` y el build puede dejar chunks incompletos (`Cannot find module './571.js'`). Si eso ocurre, detenga el dev server, elimine `frontend\.next` y vuelva a iniciar `npm run dev`. Para compilar y servir en producción, detenga primero el dev server y use `npm run build` + `npm run start`.

## Prueba integral de extremo a extremo

Con Docker, la API y la web en ejecución:

```powershell
powershell -ExecutionPolicy Bypass -File tests/verificar-flujo.ps1
```

Ejecuta 45 comprobaciones sobre catálogo público, seguridad, roles, capacidad, GPS, tarifas, pagos, trasbordos, emergencias, notificaciones, historial y reportes (incluye filtros y exportación CSV). Limpia las tablas de operación al empezar y al terminar, elimina los micros temporales `QA*` y restaura el micro demo, así que puede ejecutarse varias veces seguidas. Imprime un resumen con PASS/FAIL y termina con código 1 si hay fallos.

## Verificación de rendimiento, recuperación, GPS y WebSocket

Con Docker, la API y la web en ejecución:

```powershell
powershell -ExecutionPolicy Bypass -File tests/prueba-carga.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-restore.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-gps-real.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-websocket.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-fotos.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-stripe.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-notificaciones.ps1
powershell -ExecutionPolicy Bypass -File tests/verificar-usuarios.ps1
```

`prueba-carga.ps1` lanza 20 usuarios concurrentes × 5 iteraciones × 4 endpoints públicos (400 peticiones) y exige 0 errores y p95 ≤ 3000 ms. Resultado obtenido: **0 errores, promedio 87 ms, p95 124 ms, máximo 1014 ms**. Acepta `-Usuarios`, `-Iteraciones` y `-BaseUrl` como parámetros.

`verificar-restore.ps1` hace `pg_dump`, crea una base temporal vacía, restaura el volcado y compara el conteo de las 14 tablas; al final elimina la base temporal. Resultado obtenido: **conteos idénticos en las 14 tablas (PASS)**.

`verificar-gps-real.ps1` envía una posición con `origen=GPS_NAVEGADOR`, comprueba que aparece etiquetada en `/micros/cercanos` y verifica que una petición sin `origen` siga defaultando a `SIMULADO`. Resultado obtenido: **3/3 PASS**.

`verificar-websocket.ps1` conecta un cliente Socket.IO por `https://www.rutabol.test`, hace login, envía una posición y comprueba que el evento `cambios` llega al navegador. Usa `--use-system-ca` para validar el certificado mkcert instalado. Resultado obtenido: **4/4 PASS** (`transport=websocket`).

`verificar-usuarios.ps1` levanta una API aislada en el puerto 3013 y comprueba la migración, el acceso por rol, el alta sin exposición del hash, el cambio de rol/estado, el bloqueo de login y de sesiones vivas, el cambio de clave, la protección del propio administrador y la baja lógica. Borra el usuario temporal al terminar. Resultado obtenido: **14/14 PASS**.
