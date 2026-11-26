# Guía actualizada — Publicación en Vercel (Ruta B)

**Estado de esta guía:** ajustada el 25 de noviembre de 2026 a la documentación actual de Vercel y al estado real del proyecto.

**URL pública del frontend:** `https://rutabol-scz-8ih4.vercel.app`
**Repo:** `https://github.com/JohnDG32/Rutabol-scz`
**Rama de entrega:** `rutabol-extras`
**Carpeta del frontend:** `frontend`

---

## 0. Primero: el ciclo global, sin detalles

Piensa en tres piezas solamente:

```text
1) NAVEGADOR
   Abres https://rutabol-scz-8ih4.vercel.app
   El frontend es Next.js y vive en Vercel.

2) TÚNEL HTTPS
   El navegador llama a https://<URL-DEL-TÚNEL>/api/...
   Cloudflared recibe esa petición en Internet y la reenvía a tu Windows.

3) WINDOWS
   NestJS escucha en http://localhost:3001/api/...
   PostgreSQL está en Docker en el puerto 5433.
   La API consulta la BD y devuelve JSON al navegador.
```

La cookie de sesión viaja del navegador a la API **cruzando dominios** (Vercel → túnel), por eso hacen falta tres ajustes juntos:

- `NEXT_PUBLIC_API_URL` en Vercel → para que el frontend sepa dónde está la API.
- `FRONTEND_ORIGIN` en el backend → para que NestJS acepte peticiones desde Vercel.
- `COOKIE_SAMESITE=none` y `COOKIE_SECURE=true` en el backend → para que la cookie se envíe entre dominios distintos.

Si falta uno de esos tres, la interfaz abre pero el login o las consultas fallan.

---

## 1. ¿Qué es Cloudflare y por qué hace falta?

**Cloudflare** es una empresa que ofrece red, DNS y protección.  
**Cloudflared** es un programita que instalas en tu Windows y crea un **túnel seguro saliente** hacia Cloudflare:

- No abres puertos en tu router.
- No necesitas IP pública.
- Obtienes una URL HTTPS temporal, por ejemplo `https://abc123.trycloudflare.com`.
- Mientras la terminal de Cloudflared esté abierta, esa URL funciona. Si la cierras, se apaga; si la reinicias, la URL cambia.

En este proyecto Cloudflared **solo reenvía al puerto 3001 de NestJS**. Nunca se expone PostgreSQL.

### ¿Hay que instalar más cosas?

No casi nada. Ya tienes Node, Docker, el repo y el backend compilado. Solo falta:

```powershell
winget install Cloudflare.cloudflared
```

Opcional, **no necesario** para la entrega: Vercel CLI (`npm i -g vercel`). Todo se puede hacer desde la网页 de Vercel.

No hace falta instalar nada más: no se usa Caddy para el túnel, no se instala Apache/Nginx y no se configura BIND9 para publicar la web.

---

## 2. Estado real comprobado

Inspeccioné el JavaScript publicado de `https://rutabol-scz-8ih4.vercel.app/` y hoy contiene:

```text
https://www.rutabol.test/api
```

Eso es el **valor por defecto** de `frontend/src/lib/api.ts`. Significa que `NEXT_PUBLIC_API_URL` todavía no está aplicada al deployment. Por eso aparece error de CORS o de conexión.

Además, en `backend\.env` hoy aparecen estas claves:

```text
ADMIN_PASSWORD
ADMIN_USERNAME
DATABASE_URL
FRONTEND_ORIGIN
PORT
RUTABOL_DEMO_PASSWORD
SESSION_SECRET
```

**Faltan** `COOKIE_SAMESITE` y `COOKIE_SECURE`. El código ya las soporta, pero hay que agregarlas.

---

## 3. Configurar Vercel, paso a paso con la interfaz actual

### 3.1 Rama de producción

En Vercel, entra a tu proyecto y ve a:

**Project Settings → Git → Production Branch**

Pon:

```text
rutabol-extras
```

Antes se veía en otra pestaña; en la versión actual está en **Settings → Git**, no dentro de Environment Variables. Si el despliegue ya salió con esa rama, igual conviene verificarlo.

### 3.2 Variable de entorno

Ve a:

**Project Settings → Environment Variables → Add New**

Completa:

| Campo | Valor |
|---|---|
| Key | `NEXT_PUBLIC_API_URL` |
| Value | `https://<URL_DEL_TÚNEL>/api` |
| Type | **Config** — no Secret, porque es una URL pública |
| Environments | Production, Preview y Development |

Guardas.

Reglas para el valor:

- Debe empezar con `https://`.
- Debe terminar exactamente en `/api`, sin barra final.
- No incluyas `/lineas`, `/auth/login` ni endpoints concretos.
- No pegues contraseñas, tokens ni el Deploy Hook.

### 3.3 Redesplegar, obligatorio

La documentación actual de Vercel dice literalmente que los cambios de variables **no se aplican a deployments anteriores**. Por eso:

**Deployments → elegir el deployment vigente → Redeploy**

O también funciona hacer un commit nuevo y pushear a `rutabol-extras`.

Después de que el estado sea **Ready**, vuelve a revisar el bundle. Ya no debe aparecer `www.rutabol.test/api`.

### 3.4 La URL pública

La URL del frontend es:

```text
https://rutabol-scz-8ih4.vercel.app
```

La encuentras en **Project Overview → Deployment → Domains** o en **Project Settings → Domains**.

La URL que empieza con:

```text
https://api.vercel.com/v1/integrations/deploy/...
```

es un **Deploy Hook**: sirve para disparar builds desde CI. No es la página pública y contiene un token. No la pongas en el informe ni en GitHub.

---

## 4. Conectar el backend en Windows

En `backend\.env` agrega o confirma:

```dotenv
FRONTEND_ORIGIN=https://rutabol-scz-8ih4.vercel.app
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

Sin barra final en `FRONTEND_ORIGIN`.

Luego reinicia la API:

```powershell
cd C:\Users\Johnd\Desktop\02_TecnologiaWeb\Rutabol-scz\Rutabol-scz\backend
npm run start
```

Si la API ya estaba arrancada, deténla con `Ctrl+C` y vuelve a arrancarla. `FRONTEND_ORIGIN` y las cookies se leen al iniciar.

---

## 5. Levantar el túnel

En una terminal PowerShell separada, déjala abierta:

```powershell
cloudflared tunnel --url http://localhost:3001
```

Copia la URL HTTPS que imprime y úsala en el paso 3.2.

Si cierras esa terminal, la URL muere. Si la reinicias y cambia la URL, actualiza `NEXT_PUBLIC_API_URL` en Vercel y haz otro **Redeploy**. El backend no necesita reiniciarse por cambiar el túnel, porque su `FRONTEND_ORIGIN` depende de Vercel, no del túnel.

---

## 6. Verificación

### 6.1 API detrás del túnel

```powershell
curl.exe -i --ssl-no-revoke "https://<URL_DEL_TÚNEL>/api/lineas"
```

Esperado: HTTP 200 con JSON.

### 6.2 Preflight CORS

```powershell
curl.exe -i --ssl-no-revoke -X OPTIONS "https://<URL_DEL_TÚNEL>/api/auth/login" -H "Origin: https://rutabol-scz-8ih4.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

Esperado:

```text
Access-Control-Allow-Origin: https://rutabol-scz-8ih4.vercel.app
Access-Control-Allow-Credentials: true
```

### 6.3 Navegador

Abre `https://rutabol-scz-8ih4.vercel.app`, inicia sesión con `admin` y revisa **DevTools → Network**:

- Las peticiones deben ir a `https://<URL_DEL_TÚNEL>/api/...`.
- No deben aparecer `localhost:3001` ni `www.rutabol.test`.

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| El bundle sigue con `www.rutabol.test/api` | La variable no se aplicó al build o el deployment es antiguo | Configurar `NEXT_PUBLIC_API_URL` y hacer **Redeploy** |
| Vercel busca `package.json` en la raíz | Root Directory incorrecto | **Root Directory = `frontend`** y redesplegar |
| CORS con `Access-Control-Allow-Origin` incorrecto | `FRONTEND_ORIGIN` no es la URL exacta de Vercel o el backend no se reinició | Poner `https://rutabol-scz-8ih4.vercel.app` y reiniciar API |
| La cookie no se envía | Faltan `COOKIE_SAMESITE=none` y `COOKIE_SECURE=true` | Agregarlas y reiniciar API |
| `Mixed Content` | La variable usa `http://` | Usar `https://<URL_DEL_TÚNEL>/api` y redesplegar |
| La API deja de responder | Se cerró la terminal de Cloudflared | Levantar el túnel; si cambió la URL, actualizar variable y redesplegar |
| Confusión con “Production Branch” | Está en **Settings → Git**, no en Environment Variables | Verificar allí que diga `rutabol-extras` |

---

## 8. Texto para el informe

Pegar en la sección 3.2 de `BORRADOR_INFORME_IMRD.md`, sustituyendo el marcador del túnel:

```markdown
- **Frontend:** publicado en `https://rutabol-scz-8ih4.vercel.app`.
- **Repositorio:** `https://github.com/JohnDG32/Rutabol-scz`.
- **API NestJS:** se ejecuta en Windows, puerto 3001, bajo el prefijo `/api`, y se expone como `https://<URL_DEL_TÚNEL>/api`.
- **PostgreSQL:** se ejecuta en Docker en Windows, puerto 5433.
- **Declaración obligatoria:** Vercel publica únicamente la interfaz. La API NestJS y PostgreSQL se ejecutan en el entorno local de Windows; la API es accesible desde la URL pública solo a través del túnel HTTPS de demostración, que se cierra al finalizar la defensa.
```
