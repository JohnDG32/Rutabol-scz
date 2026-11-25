# Guía para publicar el frontend de RUTABOL-SCZ en Vercel (Ruta B)

Esta guía es para un estudiante que recién creó su cuenta de Vercel. Cubre **solo el frontend** del monorepo. Según la **Ruta B**, el backend NestJS y PostgreSQL siguen ejecutándose en **Windows con Docker** y la API se expone mediante un **túnel HTTPS de demostración**. Vercel **no aloja la API ni la base de datos**.

- Repositorio: `https://github.com/JohnDG32/Rutabol-scz`
- Rama de entrega: `rutabol-extras`
- Carpeta del frontend: `frontend`
- Variable obligatoria: `NEXT_PUBLIC_API_URL=https://<URL_DEL_TUNEL>/api`

---

## 0. Comprobación previa: no versionar secretos

Antes de importar el proyecto, verifica desde una terminal en la raíz del repo:

```powershell
git branch --show-current
git ls-files | Select-String -Pattern '(^|/)\.env'
git log --all --name-only --pretty=format: | Sort-Object -Unique | Select-String -Pattern '(^|/)\.env'
```

Resultado esperado:

- La rama activa debe ser `rutabol-extras`.
- Solo deben aparecer archivos **plantilla**, por ejemplo `backend/.env.example` y `frontend/.env.local.example`.
- **No** deben aparecer `.env`, `.env.local`, `.env.production`, contraseñas, claves ni tokens reales.

Los `.env` reales están ignorados por Git y los ejemplos ya fueron sanitizados en todas las ramas. Si aparece algún archivo real, **detén el proceso** y solicita revisión: nunca lo subas a GitHub, lo pegues en Vercel ni lo incluyas en el informe.

---

## 1. Importar el repositorio desde GitHub en Vercel

1. Entra a Vercel y pulsa **Add New... → Project**.
2. Elige **Continue with GitHub** y autoriza el acceso al repositorio `JohnDG32/Rutabol-scz` (idealmente solo a ese repo).
3. Haz clic en **Import** junto a `JohnDG32/Rutabol-scz`.
4. En la configuración del proyecto verifica la rama: debe desplegarse `rutabol-extras`. Si la pantalla de importación no permite elegirla, importa igual y después ve a **Project Settings → Git → Production Branch** y pon `rutabol-extras`; luego haz un **Redeploy**.
5. En **Root Directory**, pulsa **Edit**, escribe `frontend` y confirma con **Continue**.  
   No dejes la raíz del monorepo (`.`).
6. En **Framework Preset**, selecciona **Next.js**. Vercel suele detectarlo automáticamente, pero confírmalo.

---

## 2. Comandos de build

En **Build and Output Settings** deja exactamente estos valores:

| Opción | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | `Next.js` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

No uses `npm run dev` ni `next dev`: Vercel necesita el build de producción.

---

## 3. Configurar la variable de entorno en el dashboard

Antes de dar **Deploy**, abre **Environment Variables** y añade una sola variable:

| Name | Value | Entornos |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<URL_DEL_TUNEL>/api` | Production, Preview y Development (al menos Production) |

Sustituye `<URL_DEL_TUNEL>` por la URL HTTPS real del túnel de demostración. Conserva el prefijo `/api` y no dejes una barra final de más. El detalle de esta variable se explica en el archivo de configuración del frontend; para esta publicación es **obligatorio** configurarla aquí.

Reglas importantes:

- Configura la variable **solo en el dashboard de Vercel**; no la escribas en un archivo versionado.
- No pegues tokens de GitHub/Vercel, contraseñas de PostgreSQL ni claves de la API.
- No copies el contenido de `.env` o `.env.local` al dashboard ni al informe.
- Esta URL apunta a la **API**, no al frontend.
- Si el túnel cambia de URL, edita la variable y haz **Redeploy** (next.js incorpora las variables `NEXT_PUBLIC_*` durante la compilación).

---

## 4. Hacer el deploy

1. Pulsa **Deploy**.
2. Espera a que el estado cambie a **Ready**. Revisa los logs: deben ejecutarse `npm install` y `npm run build` desde `frontend`.
3. Si aparece **Failed**, abre **Build Logs** y corrige el error indicado antes de volver a desplegar.

---

## 5. Obtener y verificar la URL pública

1. En **Project Overview → Domains**, copia la URL pública, por ejemplo `https://<PROYECTO>.vercel.app`.
2. Comprobación HTTP básica desde terminal:

   ```powershell
   curl -I https://<PROYECTO>.vercel.app
   ```

   Esperado: respuesta `200 OK`, o redirección `307/308` seguida de `200 OK`.

3. Comprobación en el navegador:
   - Carga la portada y el login.
   - Abre **DevTools → Network**.
   - Las peticiones a la API deben apuntar a `https://<URL_DEL_TUNEL>/api/...`, nunca a `http://localhost:3001`.
   - No deben aparecer errores de `CORS`, `Mixed Content` ni `404` en el prefijo de la API.

El túnel de demostración debe estar activo al hacer estas pruebas. Si se cierra, la interfaz puede cargar, pero las operaciones que dependen de la API fallarán; eso no significa que el deploy de Vercel esté roto.

---

## 6. Qué pegar en la sección 3.2 de `BORRADOR_INFORME_IMRD.md`

Sustituye los marcadores por los valores reales obtenidos. Conserva el resto del texto:

```markdown
### 3.2 Publicación y estado real de los componentes

> Decisión tomada: **Ruta B**. El backend y PostgreSQL se ejecutan en **Windows con Docker**; la API se expone mediante un túnel HTTPS de demostración.

- **Frontend:** publicado en `https://<PROYECTO>.vercel.app`.
- **Repositorio:** `https://github.com/JohnDG32/Rutabol-scz`.
- **API NestJS:** se ejecuta en Windows, puerto 3001, bajo el prefijo `/api`, y se expone como `https://<URL_DEL_TUNEL>/api`.
- **PostgreSQL:** se ejecuta en Docker en Windows, puerto 5433.
- **Declaración obligatoria:** Vercel publica únicamente la interfaz. La API NestJS y PostgreSQL se ejecutan en el entorno local de Windows; la API es accesible desde la URL pública solo a través del túnel HTTPS de demostración, que se cierra al finalizar la defensa.
```

Es decir, pega en **3.2** la URL de Vercel en el campo del frontend y la URL del túnel con `/api` en el campo de la API. Si el borrador también pide el enlace en el **Anexo E**, usa la misma URL de Vercel. No pegues tokens, contraseñas ni URLs con credenciales.

---

## 7. Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Couldn't find any "pages" or "app" directory` o Vercel busca `package.json` en la raíz | Se desplegó la raíz del monorepo | Configura **Root Directory = `frontend`** y haz **Redeploy**. |
| `npm ERR! enoent ... package.json` | Install Command ejecutado fuera de `frontend` | Confirma Root Directory `frontend` e Install Command `npm install`. |
| La web carga, pero pide datos a `localhost:3001` o a una URL anterior | `NEXT_PUBLIC_API_URL` no está en el dashboard o cambió sin rebuild | Añade/corrige la variable en Vercel y haz **Redeploy**. |
| La variable aparece en el dashboard pero no en el navegador | Las variables `NEXT_PUBLIC_*` se insertan en tiempo de compilación | Edita la variable y vuelve a compilar; no basta con guardar. |
| `Access-Control-Allow-Origin` / error de CORS en DevTools | NestJS no permite el origen de Vercel o el túnel no reenvía `OPTIONS` | Permite el origen `https://<PROYECTO>.vercel.app`, los métodos usados y `OPTIONS`; verifica el preflight en el túnel. No uses `*` junto con credenciales. |
| `Mixed Content: ... http://...` | La API está configurada con HTTP en lugar de HTTPS | Usa la URL HTTPS del túnel en `NEXT_PUBLIC_API_URL` y redeploy. |
| La API deja de responder al cerrar el túnel | Es una demostración, no un servicio público permanente | Déjalo declarado en 3.2; no sustituyas secretos ni expongas la BD para "arreglarlo". |
| Se desplegó la rama equivocada | Production Branch apunta a otra rama | Cambia **Production Branch** a `rutabol-extras` y haz **Redeploy**. |
