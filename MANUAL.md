# MANUAL PARA CORRER RUTABOL-SCZ EN TU COMPUTADORA

Guía básica y completa, escrita para alguien que nunca vio el proyecto.
Todos los comandos se ejecutan en **PowerShell** (el que se abre con Windows + X → Terminal de PowerShell).

Si querés ver la documentación técnica (RF/RNF, endpoints, estructura), abrí [`README.md`](README.md).

---

## 0. Instalar lo necesario (una sola vez)

| Programa | Para qué sirve | Cómo verificar que ya está |
|---|---|---|
| **Git** | descargar el proyecto | `git --version` |
| **Docker Desktop** | levantar PostgreSQL, Caddy y el DNS | `docker compose version` |
| **Node.js 20 o mayor** (incluye `npm`) | ejecutar la web y la API | `node --version` y `npm --version` |
| **mkcert** | crear el certificado HTTPS local | `& "$env:USERPROFILE\mkcert.exe" --version` |
| **Navegador** Chrome o Edge | abrir la página | — |

En esta máquina se usó Node `v26.13.0` y npm `11.20.0`. Con Node 20 LTS también funciona.

### 0.1 Instalar Docker Desktop
Descargalo de https://www.docker.com/products/docker-desktop/ e instalalo con las opciones por defecto.
Después de instalar, **iniciá Docker Desktop** y esperá a que la barra de estado diga *Running*.
Si Docker no está corriendo, los comandos `docker compose` van a fallar.

### 0.2 Instalar Node.js
Descargá la versión LTS de https://nodejs.org/ e instalala con las opciones por defecto.
Cerrá y volvé a abrir PowerShell para que se vea el cambio.

### 0.3 Instalar mkcert
Copiá y pegá esto en PowerShell (descarga el ejecutable y lo guarda en tu carpeta de usuario):

```powershell
$mkcert = "$env:USERPROFILE\mkcert.exe"
Invoke-WebRequest -Uri 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe' -OutFile $mkcert -UseBasicParsing
& $mkcert --version
```

Cuando en este manual diga `mkcert`, ejecutalo con la ruta completa:

```powershell
& "$env:USERPROFILE\mkcert.exe" -install
```

> No es obligatorio agregarlo al PATH; usar la ruta completa evita problemas.

---

## 1. Descargar el proyecto

Elegí una carpeta (por ejemplo `C:\Users\TuNombre\Documents`) y ejecutá:

```powershell
cd "$env:USERPROFILE\Documents"
git clone -b rutabol-requerimientos https://github.com/JohnDG32/Rutabol-scz.git Rutabol-scz
cd Rutabol-scz
```

Verificá que estés en la rama correcta:

```powershell
git branch --show-current
```

Debe mostrar: `rutabol-requerimientos`.

---

## 2. Crear los archivos de configuración

Los archivos `.env` **no se suben a GitHub** porque contienen secretos. Hay que crearlos a mano.
Los ejemplos sí vienen en el repo, así que se copian y listo.

Desde la raíz del proyecto (`Rutabol-scz`):

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.local.example frontend\.env.local
```

Ahora creá el `.env` de la raíz (lo usa Docker para la contraseña de PostgreSQL):

```powershell
Set-Content .env 'POSTGRES_PASSWORD=db1addf2acb392a1'
```

Revisá que los tres archivos quedaron bien:

```powershell
Get-Content backend\.env
Get-Content frontend\.env.local
Get-Content .env
```

Deben contener esto (los dos últimos valores largos son secretos de ejemplo, sirven para la demo):

**`backend\.env`**
```dotenv
PORT=3001
FRONTEND_ORIGIN=https://www.rutabol.test
DATABASE_URL=postgresql://micros:db1addf2acb392a1@localhost:5433/micros_scz
SESSION_SECRET=<cadena-larga-de-ejemplo>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<clave-de-ejemplo>
RUTABOL_DEMO_PASSWORD=RutabolDemo123
```

**`frontend\.env.local`**
```dotenv
NEXT_PUBLIC_API_URL=https://www.rutabol.test/api
```

**`.env` (raíz)**
```dotenv
POSTGRES_PASSWORD=db1addf2acb392a1
```

> **Importante:** la contraseña de `.env` tiene que ser **igual** a la que aparece en `DATABASE_URL` dentro de `backend\.env`. Si cambiás una, cambiá la otra.
> `SESSION_SECRET` debe tener al menos 32 caracteres y `ADMIN_PASSWORD` al menos 12.

---

## 3. Hacer que Windows reconozca `www.rutabol.test`

En lugar de entrar a `localhost`, vamos a usar un nombre de dominio local.
Esto se hace en el archivo `hosts` de Windows y **necesita permisos de Administrador**.

Abrí **PowerShell como Administrador** (botón derecho sobre PowerShell → *Ejecutar como administrador*) y pegá:

```powershell
Add-Content C:\Windows\System32\drivers\etc\hosts "`n127.0.0.1  www.rutabol.test  api.rutabol.test"
ipconfig /flushdns
```

Verificá que funcionó:

```powershell
ping www.rutabol.test
```

Tiene que responder desde `127.0.0.1`. Si responde otro IP o dice *"no se pudo encontrar el host"*, repetí el paso anterior como Administrador.

> Si ya había líneas con `rutabol.test`, no pasa nada: repetir el comando no rompe nada.

---

## 4. Crear el certificado HTTPS (para el candadito del navegador)

Volvé a la carpeta del proyecto con un PowerShell normal:

```powershell
cd "$env:USERPROFILE\Documents\Rutabol-scz"
New-Item -ItemType Directory -Force certs | Out-Null
```

Instalá la autoridad local de mkcert (puede pedir permisos de Administrador):

```powershell
& "$env:USERPROFILE\mkcert.exe" -install
```

Generá el certificado para los nombres que usa el proyecto:

```powershell
& "$env:USERPROFILE\mkcert.exe" -cert-file certs\rutabol.test.pem -key-file certs\rutabol.test-key.pem www.rutabol.test api.rutabol.test localhost 127.0.0.1 ::1
```

Verificá que se crearon los dos archivos:

```powershell
Get-ChildItem certs
```

Deben aparecer `rutabol.test.pem` y `rutabol.test-key.pem`.

> La carpeta `certs/` está ignorada por Git: **no se sube a GitHub**. Cada persona la genera en su máquina.

---

## 5. Levantar PostgreSQL, Caddy y el DNS con Docker

Con Docker Desktop corriendo, desde la raíz del proyecto:

```powershell
docker compose up -d
```

Esperá unos segundos y verificá:

```powershell
docker compose ps
```

Los cuatro servicios deben existir. `postgres` debe decir `(healthy)`.
`caddy` publica los puertos `80` y `443`; `postgres` usa el `5433`.

En una instalación nueva, las tablas se crean solas con los archivos `database\01_init.sql` y `database\02_migracion_rutabol.sql`. No hay que ejecutar nada más.

> Si venís de una versión vieja del proyecto y el volumen `postgres_data` ya existía, aplicá la migración una sola vez:
> ```powershell
> docker compose exec -T postgres psql -U micros -d micros_scz -f /rutabol-migration.sql
> ```

---

## 6. Instalar las librerías de Node (una sola vez, o cuando cambie `package-lock.json`)

Terminal 1, desde la raíz:

```powershell
cd backend
npm ci
```

Terminal 2, desde la raíz:

```powershell
cd frontend
npm ci
```

`npm ci` instala exactamente las versiones del archivo `package-lock.json`. Si da error, probá `npm install`.

---

## 7. Arrancar la API (terminal 1)

En la terminal donde hiciste `cd backend`:

```powershell
npm run start:dev
```

Debe aparecer un mensaje parecido a:

```text
API RUTABOL-SCZ disponible en https://www.rutabol.test/api
```

**No cierres esta terminal.** La API queda escuchando internamente en `http://localhost:3001/api`.

Si querés comprobarla desde otra terminal:

```powershell
curl.exe -s -o NUL -w "api=%{http_code}\n" http://localhost:3001/api/lineas
```

Debe mostrar `api=200`.

---

## 8. Arrancar la web (terminal 2)

En la terminal donde hiciste `cd frontend`:

```powershell
npm run dev
```

Esperá a que aparezca algo como `Ready in ... s` o `Local: http://localhost:3000`.
**No cierres esta terminal.** Tampoco ejecutes `npm run build` mientras el `dev` esté activo (ver problema 1 al final).

---

## 9. Abrir y probar

Abrí tu navegador y entrá a:

```text
https://www.rutabol.test
```

Debe aparecer la pantalla de RUTABOL-SCZ con el **candadito** en la barra de direcciones.
Si escribís `http://www.rutabol.test`, Caddy te redirige automáticamente a HTTPS.

Comprobaciones rápidas:

```powershell
curl.exe --ssl-no-revoke -s -o NUL -w "web=%{http_code}\n" https://www.rutabol.test
curl.exe --ssl-no-revoke -s -o NUL -w "api=%{http_code}\n" https://www.rutabol.test/api/lineas
curl.exe --ssl-no-revoke -s -I http://www.rutabol.test | Select-String 'HTTP/|Location'
```

Resultado esperado: `web=200`, `api=200` y un `308` con `Location: https://www.rutabol.test/`.

### Usuarios de demostración

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | la de `ADMIN_PASSWORD` en `backend\.env` | ADMIN |
| `conductor1` | `RutabolDemo123` | CONDUCTOR |
| `pasajero1` | `RutabolDemo123` | PASAJERO |
| `estudiante1` | `RutabolDemo123` | ESTUDIANTE |

Ingresá con **Iniciar sesión** en la esquina de la página. Los usuarios se crean solos cuando arranca la API.

Para ver la cookie de sesión desde la terminal:

```powershell
curl.exe --ssl-no-revoke -i -X POST https://www.rutabol.test/api/auth/login -H "Content-Type: application/json" -d '{"username":"pasajero1","password":"RutabolDemo123"}' | Select-String 'HTTP/|Set-Cookie'
```

Debe aparecer `Set-Cookie: rutabol.sid=...; HttpOnly; Secure; SameSite=Lax`.

### 9.1 GPS real del navegador (opcional)

El navegador solo permite usar el GPS en **HTTPS**, por eso hay que entrar por `https://www.rutabol.test` y aceptar el permiso cuando aparezca.

- **Como pasajero:** en la sección *Micros cercanos*, presione **Buscar con mi ubicación**. La página usa sus coordenadas reales para calcular la distancia. Si el GPS falla o no da permiso, aparece un aviso y se usa la ubicación de demostración; también puede presionar **Usar ubicación de demostración**.
- **Como conductor:** en el panel, dentro de *Actualizar GPS*, presione **Usar mi ubicación real**. Se completan latitud y longitud y se muestra la precisión aproximada en metros. Después presione **Enviar posición**. Si no quiere usar el GPS, puede escribir las coordenadas a mano como antes.

Cada posición guardada lleva un origen: `SIMULADO` (por defecto), `MANUAL` (escrita a mano) o `GPS_NAVEGADOR` (del dispositivo). En *Micros cercanos* verá la etiqueta **GPS real** en las posiciones enviadas desde un dispositivo.

> Las posiciones de los micros de demostración siguen siendo simuladas. Esta opción agrega el GPS real sin sacar el modo demo.

### 9.2 Cambios en tiempo real

Cuando un conductor envía una posición, o el administrador cambia una tarifa o crea un viaje, **las demás pestañas se actualizan solas** en cuestión de milisegundos. Eso es WebSocket (Socket.IO), que viaja por el mismo `https://www.rutabol.test` que la página, gracias a la regla `/socket.io/*` de Caddy.

Si por algún motivo el WebSocket no conecta, la página sigue actualizándose cada **60 segundos** (polling). No hay que configurar nada extra: abra dos pestañas con usuarios distintos y pruebe a enviar una posición desde una; en la otra verá el cambio sin recargar.

### 9.3 Mapa callejero real

Después de presionar **Buscar con mi ubicación** o **Usar ubicación de demostración**, aparece un mapa real de OpenStreetMap:

- El círculo punteado marca el radio de **5 km**.
- El punto oscuro es su ubicación; cada micro tiene un círculo con su número interno y el color de su línea.
- Al hacer clic en un micro se ve su placa, línea, distancia y si su posición es GPS real o simulada.

Si no hay internet, las calles no cargan y aparece un aviso: presione **Mapa esquemático** para seguir viendo las posiciones relativas. También puede cambiar entre ambos mapas con los botones que están arriba del mapa.

---

## 10. Prueba completa (45 comprobaciones)

Con Docker, la API y la web corriendo, desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File tests\verificar-flujo.ps1
```

Al final debe mostrar:

```text
TOTAL: 45  PASS: 45  FAIL: 0
```

El script limpia las tablas de operación antes y después, por lo que puede ejecutarse las veces que quiera. Ojo: borra pagos/viajes de demostración anteriores, no solo los que crea en esa ejecución.

### 10.1 Otras verificaciones (opcional pero recomendado)

Mientras Docker, la API y la web sigan corriendo:

```powershell
powershell -ExecutionPolicy Bypass -File tests\prueba-carga.ps1
powershell -ExecutionPolicy Bypass -File tests\verificar-restore.ps1
powershell -ExecutionPolicy Bypass -File tests\verificar-gps-real.ps1
powershell -ExecutionPolicy Bypass -File tests\verificar-websocket.ps1
```

El primero simula 20 usuarios al mismo tiempo y mide cuánto tarda cada respuesta. Debe terminar con `PASS - p95 <= 3000 ms y sin errores`. En esta máquina dio 400 peticiones, 0 errores, promedio 87 ms y p95 124 ms.

El segundo hace una copia de la base, la restaura en una base vacía temporal y compara las 14 tablas. Debe terminar con `PASS - el restore reprodujo los datos exactamente`. Después borra la base temporal sola.

El tercero comprueba el GPS real a nivel API: envía una posición con origen `GPS_NAVEGADOR`, la busca en `micros/cercanos` y verifica que una posición sin origen siga siendo `SIMULADO`. Debe terminar con `TOTAL: 3  PASS: 3  FAIL: 0`.

El cuarto conecta un cliente WebSocket por HTTPS, envía una posición y confirma que el evento `cambios` llega al navegador. Debe terminar con `TOTAL: 4  PASS: 4  FAIL: 0` y `transport=websocket`.

Si querés una carga más liviana: `powershell -ExecutionPolicy Bypass -File tests\prueba-carga.ps1 -Usuarios 5 -Iteraciones 2`.

---

## 11. Cómo detener y volver a arrancar

- **Detener la web y la API:** presioná `Ctrl + C` en cada terminal.
- **Detener Docker (sin borrar datos):** `docker compose down`
- **Volver a arrancar todo:** repetí los pasos 5, 7 y 8.
- **Borrar la base de datos por completo** (solo si querés empezar de cero): `docker compose down -v` y después `docker compose up -d`.

---

## 12. Problemas comunes

### 1. Error `Cannot find module './571.js'` o pantalla de *Runtime Error*
Se debe a que se ejecutó `npm run build` con el `npm run dev` activo. Arreglo:

```powershell
# En la terminal del frontend: Ctrl + C
Remove-Item -Recurse -Force frontend\.next
cd frontend
npm run dev
```

Regla: para desarrollar usá `npm run dev`; para producción pará el dev y recién ahí `npm run build` + `npm run start`.

### 2. El navegador dice `NET::ERR_CERT_AUTHORITY_INVALID`
La autoridad de mkcert no quedó instalada. Ejecutá:

```powershell
& "$env:USERPROFILE\mkcert.exe" -install
docker compose restart caddy
```

Cerrá y volvé a abrir el navegador.

### 3. `curl.exe` da error de revocación (`CRYPT_E_NO_REVOCATION_CHECK`)
Es una particularidad de curl en Windows con certificados locales. Agregá `--ssl-no-revoke` como en los ejemplos. El navegador no tiene este problema.

### 4. `docker compose up -d` falla porque el puerto 80, 443 o 53 está ocupado
Buscá qué proceso lo usa:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 80,443 -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess
```

Cerrá ese programa (por ejemplo otro servidor web) y volvé a correr `docker compose up -d`.

### 5. La API dice error de conexión a PostgreSQL
Verificá que Docker esté corriendo y que la contraseña coincida:

```powershell
docker compose ps
docker compose logs --tail=20 postgres
```

Compará `POSTGRES_PASSWORD` de la raíz con la contraseña de `DATABASE_URL` en `backend\.env`.

### 6. La web carga pero las consultas fallan (CORS o mixed content)
Revisá que no queden URLs `http://` en los `.env`. Deben ser:

```dotenv
FRONTEND_ORIGIN=https://www.rutabol.test
NEXT_PUBLIC_API_URL=https://www.rutabol.test/api
```

Después de cambiarlos, reiniciá la API y la web (`Ctrl + C` y arrancar de nuevo).

### 7. `ping www.rutabol.test` no responde `127.0.0.1`
Repetí el paso 3 en PowerShell como Administrador y hacé `ipconfig /flushdns`.

---

## 13. En macOS o Linux (resumen)

- El archivo de nombres es `/etc/hosts` (editarlo con `sudo`).
- mkcert se instala con `brew install mkcert` (macOS) o con el paquete de tu distro.
- El resto de los comandos es igual, con `/` en vez de `\` en las rutas.

---

## Nota final

HTTPS con `www.rutabol.test`, el certificado, Caddy, DNS BIND opcional y el script de 45 pruebas son **extras** de este proyecto; la Actividad 01 solo pedía la aplicación con RF/RNF, cookies, sesión y base de datos. Están incluidos para que la demo se vea más parecida a un entorno real, sin pagar nada.
