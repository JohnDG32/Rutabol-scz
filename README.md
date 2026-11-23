# RUTABOL-SCZ

**Tecnología Web I · Ingeniería de Sistemas · Actividad 01**

Sistema web para mejorar el control, la seguridad, la organización y la transparencia del transporte público de micros en Santa Cruz de la Sierra. Implementa los 24 requerimientos funcionales y 18 no funcionales documentados en [`REQUERIMIENTOS.md`](REQUERIMIENTOS.md).

> Proyecto académico con datos ficticios. GPS, pasarela de pagos y fotografías son simulados; no representan operación oficial.

## Tecnologías

- **Frontend:** Next.js 15 + React 19 + TypeScript.
- **Backend:** NestJS 11 + TypeScript + `class-validator`, `bcryptjs`, `express-session` con `connect-pg-simple`.
- **Base de datos:** PostgreSQL 17 en Docker Compose.
- **Infraestructura local:** DNS BIND9 opcional (ver `README-DNS.md`).

## Puesta en marcha

### 0. Nombre de la página

La web se abre en **http://www.rutabol.test:3000** y la API en **http://www.rutabol.test:3001/api**. Para que Windows resuelva ese nombre, agregue una línea al archivo `C:\Windows\System32\drivers\etc\hosts` **desde un PowerShell como Administrador**:

```powershell
Add-Content C:\Windows\System32\drivers\etc\hosts "`n127.0.0.1  www.rutabol.test  api.rutabol.test"
```

El DNS BIND de `dns/` ya publica la zona `rutabol.test` (registros A `www` y `api` → `127.0.0.1`), pero el navegador no la consulta a menos que se cambie el resolvedor del sistema. El archivo `hosts` es la forma más simple de probar sin modificar la configuración de red. Ver [`README-DNS.md`](README-DNS.md).

### 1. Base de datos

Desde la raíz del repositorio:

```powershell
docker compose up -d
docker compose ps
```

Si el volumen `postgres_data` ya existía con el esquema anterior de "Micros SCZ", aplique la migración idempotente una sola vez:

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

Escucha en `http://www.rutabol.test:3001/api`. El archivo `backend/.env` debe contener:

```dotenv
PORT=3001
FRONTEND_ORIGIN=http://www.rutabol.test:3000
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

Visite **http://www.rutabol.test:3000**. La URL de la API se configura en `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://www.rutabol.test:3001/api
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
frontend/src/
  app/            página principal y estilos
  components/     Acceso, Consultas, PanelConductor, PanelPasajero, PanelAdmin
  lib/            api.ts (cliente HTTP) y types.ts
database/         01_init.sql y 02_migracion_rutabol.sql
```

## Flujo básico de prueba

1. Ingrese como **admin** y registre/ autorice un micro (capacidad entre 18 y 25).
2. Como **conductor1**, inicie un viaje y envíe una posición GPS.
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
| POST/PATCH/DELETE | `/api/lineas`, `/api/micros`, `/api/conductores`, `/api/tarifas`, `/api/estudiantes` | ADMIN |
| POST | `/api/micros/:id/posicion` | CONDUCTOR, ADMIN |
| POST | `/api/pagos`, `/api/pagos/:id/confirmar` | Sesión iniciada |
| GET | `/api/viajes/historial`, `/api/pagos/mios`, `/api/notificaciones` | Sesión iniciada |
| POST | `/api/viajes`, `/api/viajes/:id/{abordar,bajar,finalizar,trasbordo,emergencia}` | CONDUCTOR, ADMIN |
| GET | `/api/reportes/resumen?desde=&hasta=&lineaId=` | ADMIN |
| GET | `/api/reportes/exportar?desde=&hasta=&lineaId=` | ADMIN (CSV) |

Listado completo y trazabilidad RF/RNF/RN: [`REQUERIMIENTOS.md`](REQUERIMIENTOS.md).

## Copias de seguridad

```powershell
docker compose exec -T postgres pg_dump -U micros -d micros_scz > backup_rutabol.sql
docker compose exec -T postgres psql -U micros -d micros_scz < backup_rutabol.sql
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

Ejecuta 45 comprobaciones sobre catálogo público, seguridad, roles, capacidad, GPS, tarifas, pagos, trasbordos, emergencias, notificaciones, historial y reportes (incluye filtros y exportación CSV). Al finalizar elimina los micros temporales `QA*` y restaura el micro demo; imprime un resumen con PASS/FAIL y termina con código 1 si hay fallos.
