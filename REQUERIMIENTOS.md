# RUTABOL-SCZ — Actividad 01: requerimientos funcionales y no funcionales

**Autores:** John Diego Gutierrez Chamo · Johan Sebastian Moreno Roca · Carlos Eduardo Salvatierra Chavez
**Fecha del documento original:** 3 de noviembre de 2026
**Implementación:** tecnología web (Next.js + NestJS + PostgreSQL) sobre el proyecto base "Micros SCZ".

---

## 1. Alcance implementado

El sistema cubre los 24 requerimientos funcionales y los 18 no funcionales del enunciado en una primera fase ejecutable:

- **Backend REST (NestJS):** 13 módulos (autenticación, líneas, micros, conductores, tarifas, estudiantes, pagos, viajes, notificaciones, reportes, usuarios, auditoría y base de datos).
- **Frontend web (Next.js):** catálogo público, consulta de tarifas, micros cercanos, panel del conductor, panel del pasajero/estudiante, panel administrativo y dashboard posterior al login.
- **Persistencia (PostgreSQL):** esquema completo con claves foráneas, restricciones `CHECK`, índices y datos de demostración.
- **Servicios simulados:** posiciones GPS de demostración, pasarela de pagos y fotografías de estudiantes (archivos en disco). El conductor puede enviar su posición real desde el navegador y el sistema registra el origen de cada posición. No se almacenan datos reales de tarjetas. Como extra opcional, la pasarela puede cambiarse a Stripe en modo de prueba sin modificar el flujo simulado por defecto.

> Los nombres de líneas, placas, posiciones y usuarios son ficticios. No representan información oficial de transporte.

---

## 2. Arquitectura

```text
Navegador (Next.js :3000)
   │ fetch JSON + cookie httpOnly "rutabol.sid" (credentials: include)
   ▼
API NestJS (:3001/api)
   │ RolesGuard global + AuditoriaInterceptor global
   ├─ auth, lineas, micros, conductores, tarifas
   ├─ estudiantes, pagos, viajes, notificaciones, reportes, usuarios
   ▼
PostgreSQL (:5433) — volumen postgres_data
   ├─ lineas, micros, usuarios, conductores, tarifas, estudiantes
   ├─ viajes, pagos, abordajes, trasbordos, posiciones
   └─ notificaciones, auditoria, session (connect-pg-simple)
```

---

## 3. Actores y roles

| Actor | Rol en `usuarios` | Permisos principales |
|---|---|---|
| Administrador | `ADMIN` | CRUD de líneas, micros, conductores, tarifas, estudiantes y usuarios; reportes; notificaciones; verificación de estudiantes |
| Conductor | `CONDUCTOR` | Iniciar/finalizar viaje, abordajes, bajas, trasbordos, emergencias, enviar GPS, validar estudiantes |
| Pasajero | `PASAJERO` | Consultar tarifas y micros, crear/confirmar pagos, historial, notificaciones |
| Estudiante | `ESTUDIANTE` | Lo anterior + tarifas diferenciadas previa verificación |
| Pasarela de pagos | — | Simulada mediante `POST /api/pagos/:id/confirmar` |

Usuarios de demostración creados al iniciar el backend: `admin`, `conductor1`, `pasajero1`, `estudiante1`. La contraseña de los tres últimos se define en `RUTABOL_DEMO_PASSWORD` (por defecto `RutabolDemo123`).

---

## 4. Matriz de requerimientos funcionales

| Código | Requerimiento | Implementación | Endpoint / archivo clave |
|---|---|---|---|
| RF-01 | Registro de micros por línea e interno | CRUD de micros con placa e interno únicos | `POST /api/micros`, `micros/` |
| RF-02 | Validación de micros autorizados | Campo `micros.autorizado`; un viaje solo arranca si es `true` | `POST /api/viajes`, `viajes.service.ts` |
| RF-03 | Registro de conductores y micro asignado | Entidad `conductores` con `usuario_id` y `micro_id` | `/api/conductores` |
| RF-04 | Control de tarifas autorizadas | Tarifa por línea y categoría; el sistema calcula el monto del pago | `tarifas/`, `pagos.service.ts` |
| RF-05 | Consulta de tarifas | Consulta pública filtrable | `GET /api/tarifas?lineaId=&categoria=`, `Consultas.tsx` |
| RF-06 | Geolocalización en tiempo real | Historial de posiciones y última posición por micro; origen `SIMULADO`, `MANUAL` o `GPS_NAVEGADOR` | `POST /api/micros/:id/posicion` |
| RF-07 | Micros cercanos en 5 km | Distancia Haversine sobre la última posición | `GET /api/micros/cercanos?lat=&lng=&radio=5` |
| RF-08 | Control de pasajeros | Abordajes y bajas por viaje | `POST /api/viajes/:id/abordar`, `/bajar` |
| RF-09 | Capacidad 18–25 | `CHECK (capacidad BETWEEN 18 AND 25)`, DTO y formulario | `01_init.sql`, `create-micro.dto.ts` |
| RF-10 | Alerta y bloqueo al llenarse | Estado `LLENO`, notificaciones y error 409 | `viajes.service.ts` |
| RF-11 | Trasbordos entre micros de una línea | Nuevo viaje destino + traslado de abordajes | `POST /api/viajes/:id/trasbordo` |
| RF-12 | No cobrar dos veces en trasbordo | El abordaje destino reutiliza el mismo `pago_id` | `trasbordos.pago_reutilizado` |
| RF-13 | Validación de escolares (RUDE + foto) | Registro con categoría `ESCOLAR`, código y foto | `/api/estudiantes` |
| RF-14 | Validación de universitarios | Código + correo `@upds.edu.bo` + foto | `estudiantes.service.ts` |
| RF-15 | Clasificación de estudiantes | `categoria` en estudiante, pago y tarifa | `tarifas`, `pagos`, `abordajes` |
| RF-16 | Verificación de identidad | Validación por código/categoría y comparación de foto | `POST /api/estudiantes/validar`, `/:id/verificar` |
| RF-17 | Pagos electrónicos | Pago con token simulado; monto calculado por el sistema | `POST /api/pagos` |
| RF-18 | Confirmación y registro transaccional | Estado `CONFIRMADO`, referencia y fecha de confirmación | `POST /api/pagos/:id/confirmar` |
| RF-19 | Trasbordo de emergencia | Viaje tipo `EMERGENCIA`, micro origen en estado `EMERGENCIA` | `POST /api/viajes/:id/emergencia` |
| RF-20 | Notificaciones de emergencia | Avisos a `PASAJEROS` y `ADMIN` (y de capacidad) | `notificaciones/`, `GET /api/notificaciones` |
| RF-21 | Historial de viajes, pagos, trasbordos y micros | Consulta agregada por usuario | `GET /api/viajes/historial` |
| RF-22 | Panel administrativo | Gestión de líneas, micros, conductores, tarifas, estudiantes y reportes | `PanelAdmin.tsx` |
| RF-23 | Reportes estadísticos | Pasajeros, pagos, ocupación, trasbordos y emergencias | `GET /api/reportes/resumen` |
| RF-24 | Estado de disponibilidad | `DISPONIBLE`, `EN_CIRCULACION`, `LLENO`, `FUERA_DE_SERVICIO`, `EMERGENCIA` + ocupación | `GET /api/micros` |

> En el enunciado original, el registro de pasajeros aparece como "RF-0" por error de numeración; se interpreta como RF-08.

---

## 5. Matriz de requerimientos no funcionales

| Código | Requerimiento | Cobertura |
|---|---|---|
| RNF-01 | Seguridad | bcrypt para contraseñas, sesiones en PostgreSQL, `RolesGuard` por endpoint, `ValidationPipe` con whitelist |
| RNF-02 | Privacidad | Cookie `httpOnly`/`sameSite`/`secure` en HTTPS local (Caddy + mkcert), auditoría sin contraseñas/tokens/fotos, sin datos de tarjeta; limitación: fotos se guardan como data URL en BD local |
| RNF-03 | Rendimiento (≤ 3 s) | Consultas parametrizadas e índices en `posiciones`, `abordajes`, `pagos`, `tarifas` y `viajes`; prueba de carga `tests/prueba-carga.ps1`: 400 peticiones (20 usuarios × 5 iteraciones × 4 endpoints), 0 errores, promedio 87 ms, p95 124 ms, máximo 1014 ms |
| RNF-04 | Disponibilidad | `restart: unless-stopped` en Compose y healthcheck de PostgreSQL |
| RNF-05 | Precisión GPS | Validación de latitud/longitud; botón de GPS real del navegador (`navigator.geolocation`, HTTPS) con precisión en metros y respaldo manual; cada posición guarda su origen. La precisión final depende del dispositivo y las posiciones de demostración siguen siendo simuladas |
| RNF-06 | Usabilidad | Interfaz en español con formularios, tablas, estados visuales y mensajes de error |
| RNF-07 | Compatibilidad | Aplicación web responsive para navegadores modernos; Android/iOS se atienden vía navegador (no hay apps nativas) |
| RNF-08 | Escalabilidad | Módulos NestJS independientes; nuevas líneas, micros y conductores se registran sin reiniciar |
| RNF-09 | Integridad de datos | Claves foráneas, `UNIQUE`, `CHECK`, índices parciales y validaciones en DTO |
| RNF-10 | Conectividad | Todas las operaciones usan la API REST; el frontend muestra error de conexión |
| RNF-11 | Recuperación | Volumen `postgres_data` y `pg_dump`; restore verificado con `tests/verificar-restore.ps1` sobre una base vacía: las 14 tablas quedan con conteos idénticos a la original |
| RNF-12 | Mantenibilidad | Separación por módulos, capa `api.ts` centralizada y componentes React por panel |
| RNF-13 | Auditoría | `auditoria` + `AuditoriaInterceptor` registran POST/PATCH/DELETE exitosos con actor y detalles saneados |
| RNF-14 | Escalabilidad geográfica | `lineas` admite nuevas zonas y municipios; el modelo no está atado a una sola ciudad |
| RNF-15 | Seguridad de pagos | Solo se envía un token simulado; nunca se guarda número de tarjeta |
| RNF-16 | Actualización de información | Cada envío de GPS actualiza la posición y el estado del micro; un evento Socket.IO recarga la interfaz al instante, con polling de 60 s como respaldo |
| RNF-17 | Idioma | Español en toda la interfaz y en los mensajes de validación |
| RNF-18 | Adaptabilidad | CSS con breakpoints de 950 px y 600 px |

---

## 6. Reglas de negocio

| Código | Regla | mecanismo |
|---|---|---|
| RN-01 | Micro registrado y validado para operar | `micros.autorizado` + validación en `iniciar()` |
| RN-02 | Cobrar solo la tarifa autorizada | `tarifas.tarifaVigente()` y comparación con `pagos.monto` |
| RN-03 | Capacidad 18–25 | `CHECK` en PostgreSQL y `@Min(18) @Max(25)` en DTO |
| RN-04 | Micro lleno no acepta más pasajeros | Conteo de abordajes activos antes de insertar |
| RN-05 / RN-06 | Pago válido durante el trasbordo | Mismo `pago_id` en el nuevo abordaje y registro en `trasbordos` |
| RN-07 | Escolar con RUDE y foto | Validación en `estudiantes.service.ts` |
| RN-08 | Universitario con código, correo `@upds.edu.bo` y foto | Expresión regular en `estudiantes.service.ts` |
| RN-09 | Radio de 5 km | Parámetro por defecto de `/micros/cercanos` con Haversine |
| RN-10 | Emergencia activa trasbordo | `/viajes/:id/emergencia` + notificaciones + micro fuera de circulación |
| RN-11 | Confirmación de pasarela antes de registrar pago | `abordar()` exige `pagos.estado = 'CONFIRMADO'` |

---

## 7. Contrato API resumido

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/lineas`, `/api/lineas/:id` | Público |
| POST / PATCH / DELETE | `/api/lineas` | ADMIN |
| GET | `/api/micros`, `/api/micros/cercanos`, `/api/micros/:id` | Público |
| POST / PATCH / DELETE | `/api/micros` | ADMIN |
| POST | `/api/micros/:id/posicion` | CONDUCTOR, ADMIN |
| GET | `/api/tarifas` | Público |
| POST / PATCH / DELETE | `/api/tarifas` | ADMIN |
| GET / POST / PATCH / DELETE | `/api/conductores` | ADMIN |
| GET | `/api/conductores/yo` | CONDUCTOR |
| GET / POST / PATCH / DELETE | `/api/estudiantes` | ADMIN |
| POST | `/api/estudiantes/validar` | CONDUCTOR, ADMIN |
| GET | `/api/estudiantes/yo` | ESTUDIANTE |
| GET / POST / PATCH / DELETE | `/api/usuarios`, `/api/usuarios/:id` | ADMIN |
| POST | `/api/pagos`, `/api/pagos/:id/confirmar` | Todos los roles autenticados |
| GET | `/api/pagos/mios`, `/api/viajes/historial`, `/api/notificaciones` | Todos los roles autenticados |
| GET | `/api/viajes/activos` | ADMIN, CONDUCTOR |
| POST | `/api/viajes`, `/api/viajes/:id/{abordar,bajar,finalizar,trasbordo,emergencia}` | CONDUCTOR, ADMIN |
| GET | `/api/reportes/resumen` | ADMIN |
| POST / GET / POST | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` | Público / sesión iniciada |

---

## 8. Modelo de datos

`lineas`, `micros`, `usuarios`, `conductores`, `tarifas`, `estudiantes`, `viajes`, `pagos`, `abordajes`, `trasbordos`, `posiciones`, `notificaciones`, `auditoria` y la tabla de sesiones gestionada por `connect-pg-simple`.

Las definiciones están en `database/01_init.sql` (instalación nueva) y `database/02_migracion_rutabol.sql` (actualización idempotente de la base anterior).

---

## 9. Verificación ejecutada en entorno local

Entorno: Docker Desktop con PostgreSQL, Caddy + mkcert, API en `:3001` y web en `:3000`, accediendo por `https://www.rutabol.test`. La compilación de backend (`nest build`) y frontend (`next build`) y el chequeo de tipos (`tsc --noEmit`) pasaron correctamente.

| Verificación | Comando | Resultado |
|---|---|---|
| Flujo completo (45 comprobaciones) | `tests/verificar-flujo.ps1` | **45/45 PASS**. Limpia al inicio y al final, así que es repetible |
| GPS real / origen de posición | `tests/verificar-gps-real.ps1` | **3/3 PASS** (`GPS_NAVEGADOR`, etiqueta en cercanos, default `SIMULADO`) |
| WebSocket en tiempo real | `tests/verificar-websocket.ps1` | **4/4 PASS**, `transport=websocket` por HTTPS |
| Fotografías fuera de la BD | `tests/verificar-fotos.ps1` | **5/5 PASS** (URL de archivo, archivo en disco, HTTPS, validación por bytes, 0 data URLs) |
| Pasarela Stripe (extra) | `tests/verificar-stripe.ps1` | **10/10 PASS** (modo simulado intacto, esquema, API aislada, checkout con clave inválida, pago pendiente) |
| Notificaciones externas (extra) | `tests/verificar-notificaciones.ps1` | **10/10 PASS** (config por defecto intacta, esquema, API aislada, suscripción, aviso de prueba y correo `.eml`) |
| Dashboard y usuarios por rol (extra) | `tests/verificar-usuarios.ps1` | **14/14 PASS** (migración, roles, alta sin hash, baja lógica, sesiones vivas y clave hasheada) |
| Métricas del dashboard (extra) | `GET /api/dashboard/metricas` con las 4 sesiones demo | **4/4 roles OK**, sin `password_hash` ni datos personales |
| Carga | `tests/prueba-carga.ps1` | 400 peticiones, **0 errores**, promedio 87 ms, p95 124 ms |
| Copia de seguridad | `tests/verificar-restore.ps1` | `pg_dump` + restore en base vacía: **14/14 tablas con conteos idénticos** |
| HTTPS y sesión | `curl.exe --ssl-no-revoke -i https://www.rutabol.test/api/auth/login` | Web 200, `Set-Cookie: rutabol.sid=...; HttpOnly; Secure; SameSite=Lax` |

Los casos funcionales quedan cubiertos por la prueba integral: login por rol, validación de capacidad (18 y 26 rechazados), abordaje sin pago confirmado (rechazado), trasbordo con el mismo pago, emergencia con notificaciones y reportes con filtros/CSV.

Comandos y detalles en [`README.md`](README.md); guía paso a paso para terceros en [`MANUAL.md`](MANUAL.md).

---

## 10. Extras incorporados (fuera de la Actividad 01)

Estas mejoras **no son requerimientos de la Actividad 01**; se agregaron para acercar la demo a un entorno real:

- HTTPS local con Caddy + mkcert en `www.rutabol.test` (certificados no versionados).
- Manual para terceros (`MANUAL.md`) y scripts de verificación (E2E, carga, restore, GPS, WebSocket y fotos).
- GPS real del navegador con registro del origen de cada posición.
- Actualizaciones en tiempo real por Socket.IO, con polling de 60 s como respaldo.
- **Mapa callejero real con Leaflet + OpenStreetMap** en *Micros cercanos*, mostrando el radio de 5 km, un marcador por micro y su distancia. Si no hay internet, se avisa y se puede usar el mapa esquemático anterior (también seleccionable manualmente).
- **Fotografías de estudiantes en disco**, con migración automática de data URLs, validación por bytes y miniaturas en el panel administrativo. PostgreSQL solo conserva la URL del archivo.
- **Pasarela Stripe en modo de prueba**, activable con `PAGOS_MODO=STRIPE` y una clave `sk_test_`. El modo simulado sigue siendo el predeterminado; Checkout usa una URL alojada, la confirmación consulta la sesión real y el webhook firmado es opcional. No se guardan datos de tarjeta.
- **Notificaciones externas opcionales**: Web Push al navegador con claves VAPID y correo en modo `ARCHIVO` (archivos `.eml` en disco) o `SMTP`. Sin configuración, las notificaciones internas de los RF siguen funcionando exactamente igual; el envío externo es best-effort y nunca bloquea la operación principal.
- **Dashboard posterior al login**: ruta `/dashboard` con tarjetas específicas por rol y enlaces a los paneles correspondientes. La separación se valida en el servidor: `RolesGuard` consulta `rol` y `activo` en PostgreSQL en cada petición protegida, así que un cambio de rol o una baja surte efecto sin esperar a que venza la cookie.
- **CRUD de usuarios desde Administración**: alta, edición, cambio de rol y baja lógica con contraseñas bcrypt de 12 rondas. Las respuestas solo exponen `{ id, username, rol, activo }`. Se impide desactivar el propio administrador, cambiar su rol y dejar la instalación sin un administrador activo. La columna `activo` se agrega con `database/05_migracion_usuarios.sql` sin crear tablas nuevas.
- **Métricas en el dashboard**: `GET /api/dashboard/metricas` calcula totales generales y resúmenes por rol en PostgreSQL. El `/dashboard` muestra ocho tarjetas por rol, sin exponer claves ni datos personales.
- **Datos de operación de demostración**: `database/06_datos_operacion.sql` agrega líneas, micros, conductores, viajes, pagos, abordajes y posiciones ficticios con IDs desde 9001. Es idempotente y se aplica automáticamente en instalaciones nuevas; en bases existentes se ejecuta manualmente según `MANUAL.md`.
