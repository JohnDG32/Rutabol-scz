# Micros SCZ — Proyecto de referencia hasta Clase 7

**Tecnología Web I · Ingeniería de Sistemas · Sexto semestre**

Aplicación educativa para explorar un catálogo de líneas de micros de Santa Cruz de la Sierra y administrar unidades mediante CRUD. El catálogo contiene **datos ficticios de demostración**, no rutas oficiales ni información operativa verificada.

## Alcance por clase

- Clases 1–2: arquitectura cliente-servidor y primera aplicación Next.js.
- Clase 3: fundamentos de Docker/Apache (independientes del proyecto; no son requisito para ejecutar esta aplicación).
- Clase 6: API REST NestJS con módulos, controladores y servicios.
- Clase 7: integración Next.js ↔ NestJS con `fetch`, CORS, GET/POST/PATCH/DELETE, estados de carga y errores.
- **No implementado aún (Clase 8):** PostgreSQL, sesiones, cookies, login, autorización, Docker Compose de base de datos.

## Requisitos

Node.js **22 LTS** o superior compatible con las dependencias. npm y Git.

## Instalación

Abrir dos terminales desde la raíz:

**Terminal 1 — API**
```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

**Terminal 2 — Web**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visitar **http://localhost:3000**. La API escucha en **http://localhost:3001/api**.

> En Windows PowerShell: `Copy-Item .env.example .env` y `Copy-Item .env.local.example .env.local`.

## Arquitectura

```text
Navegador → Next.js (localhost:3000)
             │ fetch HTTP/JSON
             ▼
          NestJS (localhost:3001/api)
             ├─ LineasController → LineasService → arreglo en memoria
             └─ MicrosController → MicrosService → arreglo en memoria
```

La API devuelve **líneas de demostración** y un listado inicial de micros. Los registros nuevos se pierden cuando se reinicia el proceso NestJS: es intencional para comparar con la persistencia de Clase 8.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/lineas` | Catálogo público de líneas |
| GET | `/api/lineas/:id` | Detalle de línea |
| GET | `/api/micros` | Lista de micros |
| GET | `/api/micros/:id` | Detalle de micro |
| POST | `/api/micros` | Crear micro |
| PATCH | `/api/micros/:id` | Editar micro |
| DELETE | `/api/micros/:id` | Eliminar micro |

Ejemplo POST:
```bash
curl -i -X POST http://localhost:3001/api/micros \
  -H 'Content-Type: application/json' \
  -d '{"placa":"SCZ-2048","interno":"M-08","capacidad":35,"estado":"ACTIVO","lineaId":1}'
```

Ejemplo PATCH:
```bash
curl -i -X PATCH http://localhost:3001/api/micros/1 \
  -H 'Content-Type: application/json' \
  -d '{"estado":"MANTENIMIENTO"}'
```

Ejemplo DELETE:
```bash
curl -i -X DELETE http://localhost:3001/api/micros/1
```

Respuestas típicas: `200` lectura/edición, `201` creación, `204` eliminación, `400` validación, `404` inexistente, `409` placa o interno duplicado.



