# Configuración de DNS autoritativo local con BIND9 y Docker

Esta guía documenta la zona DNS local `rutabol.test`, servida por BIND9 en un contenedor Docker Compose. Se configuraron registros para realizar pruebas en la computadora local; no es una zona pública de Internet.

## Objetivos y resultado

- Ejecutar BIND9 como servidor autoritativo primario (master) para `rutabol.test`.
- Definir registros `SOA`, `NS` y `A`.
- Validar los archivos de configuración y consultar la zona con `dig` y `nslookup`.
- Entender que DNS resuelve nombres a direcciones, pero no inicia ni publica aplicaciones web.

Las consultas comprobadas desde Windows devolvieron `www.rutabol.test` como `127.0.0.1` y mostraron el registro SOA de la zona.

## Archivos creados

```text
compose.yaml
dns/
├── named.conf
└── zones/
    └── db.rutabol.test
```

### Servicio Docker Compose

Se agregó el servicio `dns` al `compose.yaml` existente, conservando el servicio PostgreSQL:

```yaml
services:
  dns:
    image: internetsystemsconsortium/bind9:9.20
    restart: unless-stopped
    ports:
      - "127.0.0.1:53:53/udp"
      - "127.0.0.1:53:53/tcp"
    volumes:
      - ./dns/named.conf:/etc/bind/named.conf:ro
      - ./dns/zones:/etc/bind/zones:ro
```

DNS usa normalmente el puerto 53 y puede usar tanto UDP como TCP. El puerto del equipo está enlazado a `127.0.0.1`, así que este servicio está destinado a pruebas desde la misma computadora.

### Configuración de BIND

El archivo `dns/named.conf` configura las opciones del servidor y declara la zona:

```conf
options {
    directory "/var/cache/bind";
    listen-on { any; };
    listen-on-v6 { none; };
    allow-query { any; };
    recursion no;
    allow-transfer { none; };
};

zone "rutabol.test" {
    type master;
    file "/etc/bind/zones/db.rutabol.test";
};
```

- `type master` indica que este servidor mantiene el archivo principal de la zona.
- `recursion no` hace que BIND responda por las zonas que conoce, pero no busque respuestas para dominios externos.
- `allow-transfer { none; }` deshabilita transferencias de zona a otros servidores.
- `listen-on-v6 { none; }` deshabilita la escucha por IPv6.

### Archivo de zona

El archivo `dns/zones/db.rutabol.test` contiene los registros DNS:

```dns
$TTL 3600
@   IN  SOA ns1.rutabol.test. hostmaster.rutabol.test. (
        2026112001 ; serial
        3600       ; refresh
        900        ; retry
        604800     ; expire
        300        ; negative cache
)

@       IN  NS  ns1.rutabol.test.
ns1     IN  A   127.0.0.1
@       IN  A   127.0.0.1
www     IN  A   127.0.0.1
api     IN  A   127.0.0.1
```

`$TTL 3600` establece un TTL predeterminado de 3600 segundos. El símbolo `@` representa el nombre de la zona (`rutabol.test`).

| Registro | Función en esta zona |
|---|---|
| `SOA` | Declara información administrativa y de sincronización de la zona. |
| `NS` | Indica que `ns1.rutabol.test` es el servidor de nombres de la zona. |
| `A` | Asocia un nombre con una dirección IPv4. En esta práctica, los nombres apuntan a `127.0.0.1`. |

La dirección `127.0.0.1` es la dirección de loopback: representa la propia computadora que la usa. Es apropiada para esta prueba local, pero no para que otros equipos accedan a un servidor web alojado aquí.

## ¿Por qué se utiliza el serial SOA?

El serial identifica la versión de la zona. En este proyecto es `2026112001`, siguiendo la convención `AAAAMMDDnn`: fecha y número de cambio del día. Cada vez que se edite el archivo de zona, hay que incrementar el serial, por ejemplo, a `2026112002`.

Los servidores secundarios comparan el serial para determinar si deben obtener una versión actualizada de la zona. Aunque esta práctica usa un servidor primario local, mantenerlo actualizado permite administrar la zona correctamente.

En el registro SOA:

- `ns1.rutabol.test.` es el servidor principal.
- `hostmaster.rutabol.test.` representa el contacto administrativo (el punto en el nombre codifica el separador `@` usado en la dirección de correo).
- `refresh`, `retry` y `expire` se usan para la sincronización de servidores secundarios.
- `negative cache` indica cuánto tiempo se puede almacenar una respuesta negativa.

## Configuración e inicio desde PowerShell

Ejecutar los comandos desde la raíz del proyecto:

```powershell
New-Item -ItemType Directory -Force .\dns\zones
docker compose up -d dns
docker compose ps dns
```

El servicio se expone en `127.0.0.1:53` para UDP y TCP. Para volver a iniciar el contenedor tras cambios de configuración:

```powershell
docker compose restart dns
```

Si se modifican los puertos en `compose.yaml`, recrear el servicio para aplicar el mapeo:

```powershell
docker compose up -d --force-recreate dns
```

## Validación de configuración y consultas

Comprobar la configuración de BIND y la zona:

```powershell
docker compose exec dns named-checkconf -z /etc/bind/named.conf
docker compose exec dns named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test
```

`named-checkconf -z` verifica la configuración y carga las zonas declaradas. `named-checkzone` valida directamente el archivo de zona; el resultado esperado termina en `OK`.

Consultar la zona desde el propio contenedor con `dig`:

```powershell
docker compose exec dns dig '@127.0.0.1' rutabol.test SOA +norecurse
docker compose exec dns dig '@127.0.0.1' www.rutabol.test A +noall +answer
docker compose exec dns dig +tcp '@127.0.0.1' www.rutabol.test A +noall +answer
```

En la primera consulta, `+norecurse` solicita una respuesta sin recursión; la respuesta autoritativa de BIND debe incluir la marca `aa` en los flags. La segunda y tercera consultan el registro A, por UDP y TCP respectivamente.

También se verificó desde Windows, consultando explícitamente el servidor local:

```powershell
nslookup www.rutabol.test 127.0.0.1
nslookup -type=SOA rutabol.test 127.0.0.1
```

El primer comando debe mostrar `www.rutabol.test` y la dirección `127.0.0.1`. El segundo muestra el servidor principal, el contacto administrativo, el serial y los tiempos SOA.

`dig` usa `@servidor` para seleccionar el servidor DNS. Al ejecutarlo desde PowerShell, se cita como `'@127.0.0.1'` para que PowerShell pase el argumento literalmente.

## DNS no publica una aplicación web

DNS traduce un nombre, como `www.rutabol.test`, a una dirección IP. No instala ni inicia Next.js o NestJS, no abre sus puertos y no sirve archivos web.

En este proyecto, los registros A apuntan a `127.0.0.1`, pero Next.js debe estar ejecutándose por separado. La dirección local de la aplicación sigue siendo:

```text
http://localhost:3000
```

DNS tampoco almacena el puerto de la aplicación; una URL que use el nombre DNS tendría que especificar el puerto, por ejemplo `http://www.rutabol.test:3000`.

Además, `nslookup www.rutabol.test 127.0.0.1` consulta BIND explícitamente solo para esa prueba. El navegador usa el DNS configurado en Windows, que no necesariamente es BIND. Para que el navegador resuelva el nombre habría que configurar el resolvedor del sistema. Como BIND está configurado con `recursion no`, no se debe convertir sin más en el único DNS de Windows: también habría que planificar cómo resolver nombres externos. Para esta práctica, se mantiene `localhost` para abrir la aplicación y se comprueba la zona con las herramientas DNS.

## Problemas encontrados y cómo se resolvieron

1. **`dig @127.0.0.1 ...` produjo un error de sintaxis en PowerShell.** PowerShell interpretó `@` como sintaxis propia antes de ejecutar el comando. Al usar `docker compose exec`, se resolvió citando el argumento: `dig '@127.0.0.1' ...`.
2. **`nslookup` no recibía respuesta cuando BIND se publicaba en el puerto 5300.** No se confirmó que el puerto 5300 estuviera ocupado. Se cambió el mapeo de Docker al puerto DNS estándar 53 para UDP y TCP y se recreó el contenedor. Después, `nslookup` desde Windows resolvió el registro A y devolvió el SOA.
3. **El navegador no resolvía `www.rutabol.test` aunque `nslookup` funcionaba.** `nslookup` se había dirigido explícitamente a `127.0.0.1`, pero Windows y el navegador seguían usando el resolvedor predeterminado del sistema. Se mantuvo `localhost` para acceder a la web; configurar BIND como resolvedor del sistema requiere preparar también la resolución de dominios externos.
4. **Aviso de archivo de zona sin salto de línea final.** `named-checkzone` mostró ese aviso, pero también cargó la zona y terminó en `OK`. Es un aviso de formato, no la causa de los problemas de consulta; se puede quitar añadiendo un salto de línea al final de `db.rutabol.test`.
5. **Aviso de contenedor Apache huérfano en Docker Compose.** Era independiente del servicio DNS y no impedía su inicio, por lo que no se eliminó ni se modificó como parte de esta configuración.
