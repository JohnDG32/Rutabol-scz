# Guía de arranque y apagado — Ruta B

**Orden mental:** Docker → Backend → Túnel → Vercel → Navegador.

**Frontend:** `https://rutabol-scz-8ih4.vercel.app`
**Repo:** `https://github.com/JohnDG32/Rutabol-scz`, rama `rutabol-extras`.
**Ruta local del repo:** `C:\Users\Johnd\Desktop\02_TecnologiaWeb\Rutabol-scz\Rutabol-scz`

---

## 0. Qué tiene cada terminal

| Pieza | Dónde corre | ¿Terminal abierta? |
|---|---|---|
| PostgreSQL | Docker en Windows | No: servicio en segundo plano |
| API NestJS | `backend`, puerto 3001 | **Sí** |
| Cloudflared | Túnel HTTPS | **Sí** |
| Frontend | Vercel | No: URL pública |

Si cierras la terminal de la API o del túnel, esa pieza muere. El frontend sigue abriendo, pero deja de recibir datos.

---

## 1. Arranque

### Paso 1 — Base de datos

```powershell
cd C:\Users\Johnd\Desktop\02_TecnologiaWeb\Rutabol-scz\Rutabol-scz
docker compose up -d postgres
docker compose ps
```

`postgres` debe aparecer `Up` en el puerto 5433. No hace falta levantar Caddy en la Ruta B.

### Paso 2 — API NestJS

**Terminal 1, déjala abierta:**

```powershell
cd C:\Users\Johnd\Desktop\02_TecnologiaWeb\Rutabol-scz\Rutabol-scz\backend
npm run start
```

Debe terminar con:

```text
Nest application successfully started
API RUTABOL-SCZ disponible en /api (origen permitido: https://rutabol-scz-8ih4.vercel.app)
```

Comprobación:

```powershell
curl.exe http://localhost:3001/api/lineas
```

HTTP 200 con 10 líneas.

### Paso 3 — Túnel HTTPS

**Terminal 2, déjala abierta:**

```powershell
cd C:\Users\Johnd\Desktop\02_TecnologiaWeb\Rutabol-scz\Rutabol-scz
powershell -ExecutionPolicy Bypass -File .\INICIAR_TUNEL.ps1
```

O manualmente:

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:3001
```

Copia la URL que aparece bajo *“Your quick Tunnel has been created!”*. Antes de abrir otro, comprueba que no haya uno vivo:

```powershell
Get-Process cloudflared -ErrorAction SilentlyContinue
```

### Paso 4 — Verificar por el túnel

```powershell
curl.exe -i --ssl-no-revoke "https://NUEVA_URL/api/lineas"
```

Esperado: HTTP 200.

```powershell
curl.exe -s -i --ssl-no-revoke -X OPTIONS "https://NUEVA_URL/api/auth/login" -H "Origin: https://rutabol-scz-8ih4.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

Esperado:

```text
Access-Control-Allow-Origin: https://rutabol-scz-8ih4.vercel.app
access-control-allow-credentials: true
```

### Paso 5 — Vercel si cambió la URL

1. **Settings → Environment Variables** → editar `NEXT_PUBLIC_API_URL` = `https://NUEVA_URL/api`.
2. Guardar.
3. **Deployments → Redeploy**.
4. Si sale bundle viejo, desmarcar **Use existing build cache** o hacer un commit nuevo.
5. Esperar **Ready**.

### Paso 6 — Navegador

Abrir `https://rutabol-scz-8ih4.vercel.app` y hacer **Ctrl + F5**.

- `admin` → password de `ADMIN_PASSWORD` en `backend\.env`.
- `conductor1`, `pasajero1`, `estudiante1` → `RUTABOL_DEMO_PASSWORD`.

En DevTools → Network → WS, la conexión debe apuntar a `wss://NUEVA_URL/socket.io/...`.

---

## 2. Cierre ordenado

1. **Ctrl + C** en la terminal del túnel.
2. **Ctrl + C** en la terminal de la API.
3. Opcional:
   ```powershell
   docker compose stop postgres
   ```
   o `docker compose down`. **Nunca** `docker compose down -v`: borra los datos.

El frontend en Vercel no se apaga.

---

## 3. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `cloudflared no se reconoce` | No está en el PATH | Usar `INICIAR_TUNEL.ps1` o la ruta completa |
| `No se puede conectar con la API` | Backend apagado | Repetir Paso 2 y probar `curl.exe http://localhost:3001/api/lineas` |
| Error de CORS | `FRONTEND_ORIGIN` incorrecto o API no reiniciada | Poner `https://rutabol-scz-8ih4.vercel.app` y reiniciar |
| `/api/auth/me` → 401 | Login fallido | `admin` usa `ADMIN_PASSWORD`; los otros usan `RUTABOL_DEMO_PASSWORD` |
| WebSocket falla | Bundle viejo o túnel cambiado | Actualizar variable, Redeploy y Ctrl+F5 |
| Bundle con URL antigua | Caché de Vercel | Redeploy sin caché o commit nuevo |
| Puerto 3001 ocupado | Otro `node` activo | `Get-NetTCPConnection -LocalPort 3001 -State Listen` y detener ese PID |

---

## 4. Seguridad

- No subir `.env`, `.env.local`, `certs/`, contraseñas ni Deploy Hook.
- No usar `git add -A` mientras `backend/tsconfig.tsbuildinfo` esté modificado.
- El túnel es temporal y se cierra al finalizar la defensa.
- Rotar credenciales al terminar la configuración.
