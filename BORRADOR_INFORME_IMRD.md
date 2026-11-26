# BORRADOR DE INFORME SOCIOFORMATIVO — RUTABOL-SCZ

**Estructura:** IMRyD · **Norma:** APA 7.ª edición · **Estado:** borrador editable

> Instrucciones antes de entregar:
> 1. Reemplaza todos los campos entre corchetes `[...]` por datos reales.
> 2. No incluyas claves privadas, contraseñas, tokens, `.env` ni datos personales reales.
> 3. Las secciones marcadas como **TU PARTE** deben completarse con tus capturas reales del laboratorio Ubuntu. No inventes salidas.
> 4. Formato APA sugerido: Times New Roman 12, doble espacio, márgenes 2,5 cm, paginación en la esquina superior derecha.

---

## Portada académica (APA 7)

[Universidad / Facultad / Carrera]

**Tecnología Web I — Proyecto socioformativo final**

**RUTABOL-SCZ: plataforma web para la gestión de líneas, micros y operaciones en Santa Cruz de la Sierra**

Modalidad: A. RUTABOL-SCZ  
Equipo: 3 integrantes
Integrantes: John Diego Gutierrez Chamo, Johan Sebastian Moreno Roca, Carlos Eduardo Salvatierra Chavez  
Docente: `[Nombre del docente]`  
Fecha de entrega: 26 de noviembre de 2026

---

## Resumen

Este trabajo presenta el diseño, la implementación, la verificación y la documentación de RUTABOL-SCZ, una plataforma web para gestionar líneas de micros, unidades, tarifas, viajes, pagos, trasbordos, incidencias y notificaciones en Santa Cruz de la Sierra. La solución integra un frontend en Next.js, una API REST en NestJS y persistencia en PostgreSQL, con autenticación por sesión y control de acceso por roles. Además, se documenta la infraestructura de soporte investigada: instalación de Ubuntu Server, administración de servicios con `systemctl` y `journalctl`, OpenSSH, TELNET, Postfix local y DNS con BIND9. El frontend se publica en Vercel, mientras se declara explícitamente la ubicación real de la API y la base de datos. La verificación incluyó 45 comprobaciones del flujo principal, pruebas de carga, restauración de copias de seguridad y evidencias de laboratorio. Se concluye que la arquitectura cliente-servidor permite resolver la necesidad contextualizada, siempre que se distingan claramente los componentes implementados, investigados y propuestos.

**Palabras clave:** Next.js, NestJS, PostgreSQL, Ubuntu Server, DNS, BIND9, Vercel, transporte urbano.

---

## I. Introducción

### 1.1 Contexto y problema

Los emprendimientos, pequeñas organizaciones y servicios urbanos de Santa Cruz de la Sierra presentan dificultades para registrar operaciones, garantizar la disponibilidad de información y ofrecer servicios digitales confiables. En el ámbito del transporte, la gestión de líneas, unidades, conductores, tarifas, pasajeros, pagos e incidentes suele realizarse de forma dispersa, sin trazabilidad ni validaciones automáticas.

RUTABOL-SCZ aborda esa necesidad mediante una plataforma web que centraliza el catálogo de líneas y micros, controla la capacidad y la ocupación, registra viajes y pagos, gestiona trasbordos y emergencias, y ofrece paneles diferenciados por rol.

### 1.2 Justificación y antecedentes

El proyecto retoma los requerimientos funcionales y no funcionales elaborados durante la asignatura (Actividad 01) y los lleva a una implementación ejecutable. El enunciado socioformativo permitió continuar con la modalidad RUTABOL-SCZ o migrar a un emprendimiento local; el equipo eligió continuar con la línea de transporte por ser la problemática trabajada durante el curso.

La solución se apoya en tecnologías de referencia del curso —Next.js, NestJS, PostgreSQL y Docker— y complementa el desarrollo con infraestructura de software libre.

### 1.3 Objetivo general y objetivos específicos

**Objetivo general.** Diseñar, implementar, documentar y defender una plataforma web para la gestión de líneas, micros y operaciones de RUTABOL-SCZ, integrando frontend, backend, persistencia e infraestructura, e investigar servicios Ubuntu/Linux, correo, TELNET, SSH y DNS con BIND9.

**Objetivos específicos.**

1. Implementar el catálogo público de líneas, tarifas y micros cercanos.
2. Implementar el flujo operativo de viajes, abordajes, pagos confirmados, trasbordos y emergencias.
3. Proteger las operaciones administrativas mediante autenticación, sesiones y roles.
4. Verificar el funcionamiento con pruebas normales, incorrectas y de persistencia.
5. Publicar el frontend en Vercel y declarar la ubicación real de la API y PostgreSQL.
6. Investigar y documentar Ubuntu Server, SSH, TELNET, Postfix y BIND9, distinguiendo evidencia real, pruebas de laboratorio y propuestas.

### 1.4 Alcance y vinculación con ODS

**Alcance implementado.** 24 requerimientos funcionales, 18 no funcionales y 11 reglas de negocio de la Actividad 01, más extras de GPS real, WebSocket, mapa Leaflet, fotografías en disco, Stripe en modo de prueba, notificaciones externas opcionales, dashboard por rol, CRUD de usuarios y métricas.

**Alcance no implementado.** No se exigen las nueve situaciones iniciales completas ni módulos comerciales ajenos al transporte. Stripe en producción, SMTP público y VAPID de producción quedan como propuestas pendientes de credenciales.

**ODS principal.** ODS 9: Industria, Innovación e Infraestructura.  
**ODS complementario.** ODS 11: Ciudades y Comunidades Sostenibles, por su relación con la movilidad urbana en Santa Cruz de la Sierra. También se vinculan los ODS 8 y 4 de forma secundaria.

**Eje transversal.** Innovación tecnológica, transformación digital, seguridad informática, responsabilidad social y trabajo colaborativo.

---

## II. Metodología

### 2.1 Tipo de investigación

Se trata de investigación aplicada: se identifica una necesidad real del contexto, se propone una solución tecnológica, se implementa, se verifica y se documenta. La estructura del informe sigue el modelo IMRyD.

### 2.2 Requerimientos

Los RF, RNF y RN se detallan en `REQUERIMIENTOS.md`. Resumen:

- **RF-01 a RF-24:** registro de micros por línea e interno, autorización, conductores, tarifas, geolocalización, micros cercanos en 5 km, capacidad 18–25, abordajes y bajas, trasbordos sin doble cobro, validación de estudiantes, pagos, emergencias, notificaciones, historial, panel administrativo, reportes y estados de disponibilidad.
- **RNF-01 a RNF-18:** seguridad, privacidad, rendimiento, disponibilidad, precisión GPS, usabilidad, compatibilidad, escalabilidad, integridad, conectividad, recuperación, mantenibilidad, auditoría, idioma y adaptabilidad.
- **RN-01 a RN-11:** reglas de autorización, tarifa vigente, capacidad, micro lleno, pago reutilizado, requisitos de estudiantes, radio de búsqueda, emergencia y pago confirmado previo al abordaje.

### 2.3 Arquitectura cliente-servidor

```text
Navegador / cliente web (Next.js en Vercel)
   │ HTTPS · fetch JSON · cookie de sesión httpOnly
   ▼
API REST NestJS (/api)
   │ RolesGuard + AuditoriaInterceptor + ValidationPipe
   ├─ auth, líneas, micros, conductores, tarifas
   ├─ estudiantes, pagos, viajes, notificaciones, reportes
   ├─ usuarios, dashboard, realtime (Socket.IO en /socket.io)
   ▼
PostgreSQL
   ├─ datos operativos y auditoría
   └─ tabla session (connect-pg-simple)
```

**Funciones.** Next.js construye la interfaz navegable y las vistas del proceso; NestJS expone la lógica de negocio como API REST organizada en módulos; PostgreSQL almacena la información relacional y las sesiones. Un servidor web como Apache o Nginx se diferencia del servidor de aplicación —aquí NestJS detrás de Caddy— y del servidor de base de datos. Vercel es una plataforma de despliegue para el frontend; no aloja la API ni PostgreSQL en este esquema.

### 2.4 Modelo de datos

Tablas: `lineas`, `micros`, `usuarios`, `conductores`, `tarifas`, `estudiantes`, `viajes`, `pagos`, `abordajes`, `trasbordos`, `posiciones`, `notificaciones`, `auditoria` y `session`. Las definiciones están en `database/01_init.sql` y las migraciones en `database/02_migracion_rutabol.sql`, `05_migracion_usuarios.sql` y `06_datos_operacion.sql`.

### 2.5 Flujo principal

1. El administrador registra líneas, micros autorizados, conductores y tarifas.
2. Un pasajero o estudiante consulta tarifas y micros cercanos, crea un pago y lo confirma.
3. El conductor inicia un viaje, registra GPS real o simulado, aborda pasajeros con pago confirmado y controla capacidad.
4. Si ocurre un trasbordo, se reutiliza el mismo `pago_id`; si es una emergencia, se generan notificaciones y el micro sale de circulación.
5. Los paneles muestran historial, reportes y métricas por rol.

### 2.6 Herramientas y organización del repositorio

- **Frontend:** Next.js 15, React 19, Leaflet, Socket.IO client.
- **Backend:** NestJS 11, Express session, `connect-pg-simple`, bcryptjs, Stripe en modo prueba.
- **Base de datos:** PostgreSQL 17 en Docker Compose.
- **Infraestructura:** Caddy + mkcert para HTTPS local, Ubuntu Server en VM, OpenSSH, UFW, Postfix y BIND9.
- **Repositorio:** `[ENLACE DE GITHUB]`, rama principal de entrega. `.gitignore` excluye `.env`, `.env.local`, certificados y subidas; se conservan `.env.example` y `.env.local.example`.

### 2.7 Métodos de prueba

Se emplearon scripts PowerShell de verificación: flujo integral (45 comprobaciones), GPS real (3), WebSocket (4), fotografías (5), Stripe (10), notificaciones (10), usuarios (14), métricas (4), carga (400 peticiones) y restauración (14 tablas). Cada caso registra datos de entrada, resultado esperado y resultado observado.

### 2.8 Procedimiento de investigación de infraestructura

Se siguió el manual de laboratorio de Ubuntu Server para instalar la VM, verificar versión, red y actualización, crear el usuario `operador`, preparar `/srv/rutabol`, instalar y verificar OpenSSH, administrar servicios con `systemctl` y `journalctl`, practicar autenticación por claves, configurar UFW y enviar correo local con Postfix. TELNET se investigó de forma comparativa sin instalar `telnetd` ni enviar contraseñas reales. Como ampliación exigida por el proyecto socioformativo se investigó BIND9 con una zona `.test`.

### 2.9 Cuadro: implementado, investigado y propuesto

| Componente | Estado | Evidencia / observación |
|---|---|---|
| Frontend Next.js y vistas por rol | Implementado | Catálogo, paneles y `/dashboard` |
| API NestJS y módulos | Implementado | 13 módulos bajo `/api` |
| PostgreSQL y restricciones | Implementado | 14 tablas, FK, `CHECK`, índices |
| Autenticación, sesión y roles | Implementado | Cookie `rutabol.sid`, `RolesGuard` |
| RF-01 a RF-24 y RN-01 a RN-11 | Implementado | `verificar-flujo.ps1`: 45/45 PASS |
| GPS real, WebSocket, mapa Leaflet | Implementado | Pruebas 3/3 y 4/4 PASS |
| Stripe modo prueba | Implementado | `sk_test`/`pk_test`, sin datos de tarjeta |
| Dashboard, CRUD de usuarios y métricas | Implementado | 14/14 y 4/4 PASS |
| Ubuntu Server 22.04.5 LTS | Ejecutado | E1–E5 del manual, capturas reales |
| OpenSSH, claves, UFW, `systemctl`, `journalctl` | Ejecutado | E4–E8 del manual |
| Postfix local | Ejecutado | E9 del manual |
| TELNET vs SSH | Investigado | Tabla comparativa, sin credenciales reales |
| BIND9 / DNS de laboratorio | Por ejecutar (no estaba en el manual) | Guía en `GUIA_PASO7_BIND9.md`; si no se ejecuta, se reporta como propuesto |
| Publicación en Vercel | Por ejecutar | Guía en `GUIA_VERCEL.md`; la URL se pega en la sección 3.2 |
| Túnel público para la API | Ruta B elegida; por ejecutar | Backend en Windows + túnel HTTPS; guía en `GUIA_PASO6_TUNEL.md` |
| Stripe producción, SMTP real, VAPID real | Propuesto | Pendiente de credenciales reales; no se usan en la demo |

---

## III. Resultados

### 3.1 Funcionalidades realmente implementadas

Se completó el proceso principal: alta de líneas y micros, consulta pública, creación y confirmación de pagos, inicio y finalización de viajes, abordajes con control de capacidad, trasbordos sin doble cobro, emergencias con notificaciones, historial, reportes y paneles por rol. El dashboard posterior al login muestra tarjetas y métricas calculadas en PostgreSQL, sin exponer contraseñas ni datos personales.

### 3.2 Publicación y estado real de los componentes

> Decisión tomada: **Ruta B**. El backend y PostgreSQL se ejecutan en **Windows con Docker**; la API se expone mediante un túnel HTTPS de demostración.

- **Frontend:** publicado en `https://rutabol-scz-8ih4.vercel.app`.
- **Repositorio:** `https://github.com/JohnDG32/Rutabol-scz`.
- **API NestJS:** se ejecuta en Windows, puerto 3001, bajo el prefijo `/api`, y se expone como `[URL DEL TÚNEL]/api`.
- **PostgreSQL:** se ejecuta en Docker en Windows, puerto 5433.
- **Declaración obligatoria:** Vercel publica únicamente la interfaz. La API NestJS y PostgreSQL se ejecutan en el entorno local de Windows; la API es accesible desde la URL pública solo a través del túnel HTTPS de demostración, que se cierra al finalizar la defensa.

### 3.3 Tabla de pruebas

| Escenario | Datos utilizados | Resultado esperado | Resultado observado |
|---|---|---|---|
| Flujo principal completo | Usuarios demo `admin`, `conductor1`, `pasajero1`, `estudiante1` | 45 comprobaciones correctas | **45/45 PASS** |
| Capacidad 18 y 26 | Micro con `capacidad=18`; intento con 26 | Aceptar 18, rechazar 26 | Aceptado y rechazado correctamente |
| Abordaje sin pago confirmado | Pago en estado `PENDIENTE` | Error 409, sin abordaje | Rechazado |
| Trasbordo | Viaje origen con pago confirmado | Mismo `pago_id` en el destino | Verificado |
| Emergencia | Micro en circulación | Notificación y micro fuera de servicio | Verificado |
| GPS real del navegador | `navigator.geolocation` | Origen `GPS_NAVEGADOR` y respaldo manual | **3/3 PASS** |
| Actualización en tiempo real | Socket.IO sobre HTTPS | Evento recibido por el navegador | **4/4 PASS** |
| Fotografías de estudiantes | Archivos en disco | URL de archivo, sin data URL en BD | **5/5 PASS** |
| Stripe en prueba | Clave `sk_test` inválida y modo simulado | Modo simulado intacto y errores controlados | **10/10 PASS** |
| Notificaciones externas | Modo `ARCHIVO`, correo local | `.eml` generado sin bloquear la operación | **10/10 PASS** |
| CRUD de usuarios | Alta, rol, baja lógica | Sin `password_hash` en respuestas | **14/14 PASS** |
| Métricas por rol | Cuatro sesiones demo | Totales y resúmenes por rol, sin claves | **4/4 PASS** |
| Rendimiento | 400 peticiones | 0 errores | Promedio 87 ms, p95 124 ms |
| Persistencia | `pg_dump` + restore en base vacía | 14 tablas con conteos idénticos | **14/14 PASS** |
| HTTPS y sesión | `https://www.rutabol.test/api/auth/login` | `HttpOnly; Secure; SameSite=Lax` | Verificado |

### 3.4 Evidencias de infraestructura — **TU PARTE**

Inserta aquí tus capturas reales del laboratorio, una por una, con una explicación de 2 a 4 líneas cada una. Usa estos nombres y este orden:

| Código | Nombre sugerido de la imagen | Comandos que debe mostrar | Interpretación esperada |
|---|---|---|---|
| E1 | `E1_version_red.png` | `lsb_release -a`, `hostnamectl`, `uname -m` | Ubuntu Server 22.04.5 LTS, nombre `rutabol-server`, arquitectura real |
| E2 | `E2_ip_apt.png` | `ip -br a`, `ip route`, `apt update` | IP por DHCP, conectividad y repositorios disponibles |
| E3 | `E3_operador_srv.png` | `id operador`, `ls -ld /srv/rutabol` | Usuario `operador` y directorio con propietario `operador:operador` |
| E4 | `E4_ssh_status.png` | `systemctl status ssh`, `sshd -t`, `ss -tlnp \| grep :22` | Servicio activo, habilitado, sintaxis válida y puerto 22 |
| E5 | `E5_ssh_conexion.png` | `ssh operador@IP` o `ssh -p 2222 operador@127.0.0.1`; si no hay conexión, captura de consola | Acceso remoto o impedimento NAT documentado |
| E6 | `E6_claves_ssh.png` | `ssh-keygen -t ed25519`, permisos `700` y `600`, prueba con clave | Clave pública instalada, privada protegida |
| E7 | `E7_servicios_logs.png` | `is-enabled ssh`, `is-active ssh`, `journalctl -u ssh -n 20` | Estado y registros del servicio |
| E8 | `E8_ufw.png` | `ufw allow OpenSSH`, `ufw enable`, `ufw status numbered` | Cortafuegos activo con SSH permitido |
| E9 | `E9_postfix.png` | `systemctl status postfix`, `mail -s "Prueba Postfix" operador`, `mail` | Correo local entregado al buzón de `operador` |
| E10 | `E10_bind9_checks.png` *(si se ejecuta)* | `named-checkconf`, `named-checkzone rutabol.test ...` | Sintaxis válida de configuración y zona |
| E11 | `E11_dig.png` *(si se ejecuta)* | `dig @127.0.0.1 www.rutabol.test A`, `dig @127.0.0.1 rutabol.test MX` | Registros A y MX resueltos por el DNS local |

**Plantilla de explicación para cada captura:**

> **E4 — Servicio SSH.** Se ejecutó `systemctl status ssh --no-pager`, que mostró `active (running)` y `enabled`. `ss -tlnp | grep :22` confirmó que el servidor escucha en TCP 22. Esto demuestra que OpenSSH quedó instalado y habilitado en la VM Ubuntu 22.04.5 LTS.

**Reglas para tus fotos:**

1. No muestres contraseñas, claves privadas ni tokens.
2. Si una captura muestra una IP de laboratorio, está bien; si va a un documento público, puedes difuminarla.
3. Si no ejecutaste BIND9, **no pongas E10/E11 como ejecutado**: márcalo como “investigado/propuesto” en el cuadro de la sección 2.9.
4. TELNET no tiene captura de servidor: es análisis comparativo. Incluye esta tabla:

| Característica | TELNET | SSH |
|---|---|---|
| Transporte | Texto claro | Cifrado |
| Puerto | TCP 23 | TCP 22 |
| Confidencialidad | Nula; cualquier intermediario puede leer | Cifrado de extremo a extremo |
| Autenticación | Contraseña en claro | Contraseña cifrada o clave pública |
| Recomendación | No usar para credenciales reales | Usar OpenSSH con claves y deshabilitar acceso root |

### 3.5 DNS con BIND9

Si ejecutaste el laboratorio, pega aquí los comandos y salidas reales de `named-checkconf`, `named-checkzone`, `systemctl restart bind9`, `dig` y `nslookup`. Explica SOA, NS, A, CNAME y MX. Si no lo ejecutaste, escribe que la configuración queda **propuesta** y explica el resultado esperado, marcando claramente que no fue probado.

Aclaración obligatoria: un DNS local con dominio `.test` **no publica la aplicación en Internet**, no sustituye el HTTPS de Caddy/mkcert ni a un proxy inverso. Solo resuelve nombres dentro del laboratorio.

---

## IV. Discusión

Los resultados muestran que la arquitectura cliente-servidor permite separar la interfaz, la lógica de negocio y la persistencia, facilitando la verificación de cada capa. La diferenciación de roles evita que un pasajero acceda a operaciones administrativas, y las validaciones en base de datos y DTO impiden estados inválidos como capacidades fuera de rango o abordajes sin pago confirmado.

La publicación del frontend en Vercel cumple el requisito de URL pública, pero no implica que todos los servicios sean públicos. Por ello se declara de forma explícita dónde se ejecutan la API y PostgreSQL. Si se opta por un túnel, este debe cerrarse después de la defensa y no debe exponer credenciales reales.

Entre las limitaciones se encuentran la dependencia de Internet para el mapa callejero —con mapa esquemático de respaldo—, la precisión variable del GPS del navegador, la ausencia de pasarela de pago real y la sujeción del laboratorio DNS a un dominio reservado. Como trabajo futuro se plantean Stripe en producción, SMTP corporativo, monitorización y despliegue completo de la API en un entorno público con HTTPS y copias automáticas.

---

## Conclusiones

RUTABOL-SCZ resolvió la necesidad contextualizada mediante una plataforma web funcional con proceso principal verificable, control de acceso y persistencia comprobable. La investigación de infraestructura permitió distinguir entre servicios ejecutados en laboratorio y propuestas técnicas. La entrega combina código, documentación académica, evidencias reales y una URL pública, manteniendo datos ficticios y sin secretos versionados.

---

## Referencias (APA 7.ª edición — verificar y ajustar a las fuentes realmente consultadas)

- Ubuntu. (2026). *Install Ubuntu Server*. Recuperado el 25 de noviembre de 2026, de https://ubuntu.com/tutorials/install-ubuntu-server
- Ubuntu. (2026). *OpenSSH Server*. Recuperado el 25 de noviembre de 2026, de https://ubuntu.com/server/docs/how-to/security/openssh-server/
- Ubuntu. (2026). *Mail: Postfix*. Recuperado el 25 de noviembre de 2026, de https://ubuntu.com/server/docs/mail-postfix/
- Vercel. (2026). *Documentation: Deploying Next.js*. Recuperado el 25 de noviembre de 2026, de https://vercel.com/docs
- NestJS. (2026). *Documentation*. Recuperado el 25 de noviembre de 2026, de https://docs.nestjs.com
- Next.js. (2026). *Documentation*. Recuperado el 25 de noviembre de 2026, de https://nextjs.org/docs
- PostgreSQL. (2026). *Documentation*. Recuperado el 25 de noviembre de 2026, de https://www.postgresql.org/docs/
- Internet Systems Consortium. (2026). *BIND 9 Administrator Reference Manual*. Recuperado el 25 de noviembre de 2026, de https://bind9.readthedocs.io/

---

## Anexos

- Anexo A. Capturas E1–E11 del laboratorio Ubuntu.
- Anexo B. Tabla completa de RF/RNF/RN (`REQUERIMIENTOS.md`).
- Anexo C. Salidas de los scripts de verificación.
- Anexo D. Diagrama de arquitectura y modelo de datos.
- Anexo E. Enlaces a GitHub y Vercel.

---

## Instrucciones finales para completar tu parte

1. Abre este archivo y ve a la sección **3.4 Evidencias de infraestructura**.
2. Inserta tus fotos reales una por una, en el orden E1–E9.
3. Bajo cada foto escribe 2–4 líneas usando la plantilla.
4. Si no ejecutaste BIND9, marca E10/E11 como **propuesto** y no como ejecutado. Si puedes ejecutarlo hoy, captura `named-checkconf`, `named-checkzone` y `dig`.
5. Rellena la portada con los integrantes; no pongas número de grupo, porque el docente lo asignará el día de la defensa.
6. Elige la ruta A o B y completa la sección **3.2**.
7. Pega la URL real de Vercel en **3.2** y en el Anexo E.
8. Convierte este Markdown a PDF con formato APA 7 o pásalo a Word y aplica Times New Roman 12, doble espacio y márgenes 2,5 cm.
