# Guía paso 7: laboratorio de DNS con BIND9 en Ubuntu Server 22.04.5 LTS

Esta guía complementa el manual de laboratorio de Ubuntu Server 22.04.5 LTS. El manual cubría E1–E9 (SSH, claves, UFW, Postfix), pero **no incluía BIND9**; el proyecto socioformativo sí lo exige. El procedimiento usa el dominio reservado `rutabol.test` y produce las evidencias **E10** y **E11** para la sección 3.4 de `BORRADOR_INFORME_IMRD.md`.

> **Estado del trabajo:** este documento describe un procedimiento. Solo puede afirmarse que BIND9 fue *ejecutado* si los comandos se corrieron en la VM y las capturas son reales. Si no se ejecutaron, la fila «BIND9 / DNS de laboratorio» del cuadro 2.9 debe quedar como **Propuesto/Investigado**, nunca como **Ejecutado**.

## 1. Alcance y límites

Antes de empezar, conviene dejar claro qué hace y qué no hace este laboratorio:

- BIND9 es un servidor DNS: traduce nombres como `www.rutabol.test` a direcciones IP. **No inicia** Next.js ni NestJS, **no abre** sus puertos y **no sirve** archivos web.
- Un DNS local con dominio `.test` **no publica la aplicación en Internet**. `.test` está reservado para pruebas, así que no debe esperarse resolución pública.
- Este DNS **no sustituye** el HTTPS local de Caddy + mkcert ni a un proxy inverso. Caddy termina TLS y reenvía a la aplicación; BIND9 solo responde consultas de nombres.
- En la configuración propuesta, los registros A apuntan a `127.0.0.1` (loopback de la VM). Es correcto para practicar con `dig @127.0.0.1`; si se quiere acceder desde otro equipo, debe sustituirse por la IP real de la VM.
- No se usan contraseñas, claves privadas, tokens ni secretos en esta guía.

## 2. Requisitos previos

- VM con Ubuntu Server 22.04.5 LTS y acceso con `sudo`.
- Conexión a Internet para instalar paquetes.
- Consola de la VM o sesión SSH ya funcionando (E4–E6 del manual).
- Opcional, para confirmar la versión:

```bash
lsb_release -d
```

## 3. Instalación de BIND9 y herramientas DNS

Actualizar los índices de paquetes e instalar el servidor, las utilidades de comprobación y las herramientas de consulta:

```bash
sudo apt update
sudo apt install bind9 bind9utils dnsutils -y
```

Paquetes instalados:

| Paquete | Uso en el laboratorio |
|---|---|
| `bind9` | Servidor DNS autoritativo (`named`). |
| `bind9utils` | `named-checkconf` y `named-checkzone`. |
| `dnsutils` | `dig` y `nslookup`. |

Comprobación opcional de la versión:

```bash
named -v
```

## 4. Configuración

### 4.1 Ajustar `listen-on` y `allow-query`

Se recomienda guardar una copia de seguridad antes de editar:

```bash
sudo cp /etc/bind/named.conf.options /etc/bind/named.conf.options.bak
sudo nano /etc/bind/named.conf.options
```

Dentro del bloque `options` existente, ajuste o añada estas líneas. **No duplique el bloque `options`**: conserve las opciones que ya estuvieran, por ejemplo `dnssec-validation auto;`.

```conf
options {
    directory "/var/cache/bind";

    // Laboratorio local: escuchar en loopback para no exponer el servicio.
    listen-on port 53 { 127.0.0.1; };
    listen-on-v6 { none; };

    // Solo consultas desde la propia VM; evita un resolvedor abierto.
    allow-query { localhost; };

    // Esta VM responde por su zona, no reenvía consultas a Internet.
    recursion no;

    // Conservar aquí otras opciones ya presentes en el archivo.
};
```

Si se necesita consultar BIND9 desde otro equipo del laboratorio, primero se obtiene la IP real de la VM:

```bash
ip -br a
```

Después se sustituyen los valores de ejemplo por la IP y la red reales:

```conf
listen-on port 53 { 127.0.0.1; 192.168.56.10; };
allow-query { localhost; 192.168.56.0/24; };
```

Si UFW está activo y las consultas remotas fallan, se pueden permitir las dos variantes del puerto 53 solo desde la red del laboratorio:

```bash
sudo ufw allow from 192.168.56.0/24 to any port 53 proto udp
sudo ufw allow from 192.168.56.0/24 to any port 53 proto tcp
```

La configuración de ejemplo con `127.0.0.1` es suficiente para todas las consultas `dig @127.0.0.1` pedidas en esta guía. No cambie el resolvedor del sistema de la VM: las pruebas se dirigen explícitamente a BIND9 con `@127.0.0.1`.

### 4.2 Declarar la zona maestra en `named.conf.local`

Comprobar que el archivo local está incluido desde la configuración principal:

```bash
grep -n 'named.conf.local' /etc/bind/named.conf
```

Debe aparecer una línea similar a:

```conf
include "/etc/bind/named.conf.local";
```

Editar la declaración de la zona:

```bash
sudo nano /etc/bind/named.conf.local
```

Añadir:

```conf
zone "rutabol.test" {
    type master;
    file "/etc/bind/zones/db.rutabol.test";
    allow-transfer { none; };
};
```

- `zone "rutabol.test"` define el nombre de la zona.
- `type master` indica que esta VM conserva el archivo principal de la zona.
- `file` señala la ruta del archivo con los registros.
- `allow-transfer { none; }` evita transferencias de zona a otros servidores.

### 4.3 Crear el archivo de zona

```bash
sudo mkdir -p /etc/bind/zones
sudo tee /etc/bind/zones/db.rutabol.test > /dev/null <<'EOF'
$TTL 3600
@   IN  SOA ns.rutabol.test. hostmaster.rutabol.test. (
        2026112501 ; serial (AAAAMMDDnn)
        3600       ; refresh
        900        ; retry
        604800     ; expire
        300        ; negative cache TTL
)

@       IN  NS   ns.rutabol.test.
ns      IN  A    127.0.0.1
www     IN  A    127.0.0.1
mail    IN  A    127.0.0.1
api     IN  CNAME www.rutabol.test.
@       IN  MX   10 mail.rutabol.test.
EOF
sudo chown root:root /etc/bind/zones/db.rutabol.test
sudo chmod 644 /etc/bind/zones/db.rutabol.test
```

El serial `2026112501` sigue la convención `AAAAMMDDnn` (25 de noviembre de 2026, cambio 01). **Cada vez que se modifique el archivo de zona hay que incrementarlo**, por ejemplo a `2026112502`.

## 5. Significado de los registros

| Registro | Línea de la zona | Significado | Resultado esperado |
|---|---|---|---|
| `SOA` | `@ IN SOA ns.rutabol.test. hostmaster.rutabol.test. (...)` | Información administrativa y de sincronización: servidor principal, contacto, serial, `refresh`, `retry`, `expire` y caché negativa. | La zona se carga con el serial `2026112501`. |
| `NS` | `@ IN NS ns.rutabol.test.` | Declara a `ns.rutabol.test.` como servidor de nombres autoritativo de la zona. | La consulta `NS` devuelve `ns.rutabol.test.`. |
| `A` | `ns`, `www` y `mail` → `127.0.0.1` | Asocia cada nombre con una dirección IPv4. | `www`, `ns` y `mail` resuelven a `127.0.0.1`. |
| `CNAME` | `api IN CNAME www.rutabol.test.` | Crea un alias: `api.rutabol.test` toma la dirección de `www.rutabol.test`. | La consulta devuelve el nombre canónico `www.rutabol.test.`. |
| `MX` | `@ IN MX 10 mail.rutabol.test.` | Indica el servidor de correo de la zona; `10` es la prioridad (menor número = preferido). | La consulta devuelve `10 mail.rutabol.test.`. |

Notas de sintaxis:

- `$TTL 3600` fija un tiempo de vida predeterminado de 3600 segundos (1 hora).
- `@` representa el nombre de la zona, es decir, `rutabol.test`.
- El punto final en `ns.rutabol.test.` y `mail.rutabol.test.` indica un nombre totalmente cualificado (FQDN). Sin ese punto, BIND añadiría el sufijo de la zona.
- `hostmaster.rutabol.test.` codifica el contacto administrativo `hostmaster@rutabol.test`; el primer punto se interpreta como la arroba.
- `api` es CNAME y su destino (`www`) sí tiene registro A; por eso el alias puede resolverse.

## 6. Verificación de sintaxis y arranque del servicio

Validar la configuración general. Un comando sin salida y con código de salida `0` significa que no hay errores de sintaxis:

```bash
sudo named-checkconf
echo "código de salida: $?"
```

Validar el archivo de zona:

```bash
sudo named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test
```

Resultado esperado:

```text
zone rutabol.test/IN: loaded serial 2026112501
OK
```

Habilitar BIND9 en el arranque e iniciarlo inmediatamente:

```bash
sudo systemctl enable --now bind9
```

Si el servicio ya estaba activo y solo se editaron archivos, reiniciarlo:

```bash
sudo systemctl restart bind9
```

Comprobar su estado:

```bash
systemctl status bind9 --no-pager
```

Resultado esperado: `Loaded: loaded (...; enabled; ...)`, `Active: active (running)` y sin errores recientes en las últimas líneas.

## 7. Consultas de laboratorio

Las consultas se dirigen explícitamente al servidor local con `@127.0.0.1`.

### 7.1 Registro A de `www`

```bash
dig @127.0.0.1 www.rutabol.test A
```

Resultado esperado (se recorta el encabezado):

```text
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ...
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 1, ADDITIONAL: 1
;; ANSWER SECTION:
www.rutabol.test.    3600    IN    A    127.0.0.1
```

`NOERROR` indica que la consulta se resolvió; `aa` (*authoritative answer*) indica que la respuesta proviene de la zona maestra local.

### 7.2 Registro CNAME de `api`

```bash
dig @127.0.0.1 api.rutabol.test CNAME
```

Resultado esperado:

```text
;; ANSWER SECTION:
api.rutabol.test.    3600    IN    CNAME    www.rutabol.test.
```

Según la versión de `dig`, también puede aparecer en la respuesta el registro A de `www.rutabol.test.`; lo importante es que `api` figure como CNAME hacia `www`.

### 7.3 Registro MX de la zona

```bash
dig @127.0.0.1 rutabol.test MX
```

Resultado esperado:

```text
;; ANSWER SECTION:
rutabol.test.    3600    IN    MX    10 mail.rutabol.test.
```

Puede aparecer además `mail.rutabol.test. IN A 127.0.0.1` en la sección ADDITIONAL o AUTHORITY.

### 7.4 Comprobación con `nslookup`

```bash
nslookup www.rutabol.test 127.0.0.1
```

Resultado esperado:

```text
Server:         127.0.0.1
Address:        127.0.0.1#53

Name:   www.rutabol.test
Address: 127.0.0.1
```

El último argumento de `nslookup` es el servidor DNS que se quiere consultar; por eso se usa `127.0.0.1`.

### 7.5 Registros del servicio

```bash
journalctl -u bind9 -n 20 --no-pager
```

Deben verse mensajes de inicio de BIND9, carga de la zona (`zone rutabol.test/IN: loaded serial 2026112501`) y escucha en `127.0.0.1#53`. El texto exacto varía según la versión, pero no deben aparecer errores de configuración ni de permisos.

## 8. Problemas frecuentes

| Síntoma | Causa probable | Comprobación / corrección |
|---|---|---|
| `named-checkconf` muestra errores | Llaves, punto y coma o ACL mal escritos | Revisar `/etc/bind/named.conf.options` y `/etc/bind/named.conf.local`. |
| `named-checkzone` indica `file not found` | Ruta incorrecta o permisos | Confirmar `/etc/bind/zones/db.rutabol.test`, `root:root` y `644`. |
| `dig` devuelve `REFUSED` | `allow-query` no incluye al cliente | Añadir `localhost` o la IP de laboratorio real. |
| `dig` devuelve `NXDOMAIN` | Nombre mal escrito o zona no cargada | Revisar el archivo de zona y `journalctl -u bind9`. |
| `dig` devuelve `SERVFAIL` o no hay respuesta | Zona no cargada o servicio caído | Repetir `named-checkzone`, `systemctl status bind9` y `journalctl`. |
| `connection timed out` | BIND9 no escucha o UFW bloquea | `sudo ss -tlnup | grep ':53'`; revisar UFW solo para la red de laboratorio. |
| Conflicto en el puerto 53 | Otro servicio DNS en la misma dirección | La configuración de loopback evita el stub `127.0.0.53`; no configure BIND como único resolvedor del sistema. |

Después de cualquier cambio en la zona o en las opciones, vuelva a ejecutar `sudo named-checkconf`, `sudo named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test` y `sudo systemctl restart bind9`.

## 9. Evidencias E10 y E11 para la sección 3.4

Las capturas deben mostrar comandos y salidas reales de la VM Ubuntu Server 22.04.5 LTS. No incluyan contraseñas, claves privadas ni tokens.

### E10 — `E10_bind9_checks.png`

Capturar una terminal con:

```bash
sudo named-checkconf; echo "named-checkconf exit=$?"
sudo named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test
systemctl status bind9 --no-pager
```

Debe verse el código de salida `0`, el mensaje `OK` de `named-checkzone` y el servicio `active (running)`.

### E11 — `E11_dig.png`

Capturar una terminal con:

```bash
dig @127.0.0.1 www.rutabol.test A
dig @127.0.0.1 api.rutabol.test CNAME
dig @127.0.0.1 rutabol.test MX
nslookup www.rutabol.test 127.0.0.1
journalctl -u bind9 -n 20 --no-pager
```

Deben verse `NOERROR`, las respuestas A/CNAME/MX y la dirección `127.0.0.1` devuelta por `nslookup`.

### Texto de 2–4 líneas para pegar bajo cada captura

> **E10 — Validación de BIND9.** Se ejecutaron `sudo named-checkconf` y `sudo named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test`. El primero terminó con código 0 y el segundo mostró `loaded serial 2026112501` y `OK`. `systemctl status bind9 --no-pager` confirmó el servicio `active (running)` en la VM Ubuntu 22.04.5 LTS.

> **E11 — Consultas al DNS local.** Con `dig @127.0.0.1` se obtuvieron el registro A de `www.rutabol.test` (`127.0.0.1`), el CNAME de `api.rutabol.test` hacia `www` y el MX `10 mail.rutabol.test.`. `nslookup www.rutabol.test 127.0.0.1` devolvió la misma IP y `journalctl` registró la carga de la zona. Esto prueba la resolución autoritativa dentro del laboratorio, no una publicación en Internet.

## 10. Estado que debe registrarse en el informe

| Situación real | Cuadro 2.9 | Sección 3.4 / 3.5 |
|---|---|---|
| Comandos ejecutados en la VM y capturas reales | **Ejecutado** | Insertar E10 y E11 con su explicación de 2–4 líneas y pegar las salidas reales. |
| Laboratorio no ejecutado; solo se revisó o investigó esta guía | **Propuesto/Investigado (no ejecutado)** | No presentar E10/E11 como ejecutados; indicar que la configuración queda propuesta y describir el resultado esperado. |

La fila actual del borrador dice «Por ejecutar (no estaba en el manual)». Si no se corre el laboratorio, déjela como **Propuesto/Investigado**; nunca la cambie a **Ejecutado**. La regla 3 de la sección 3.4 del borrador es explícita: «Si no ejecutaste BIND9, no pongas E10/E11 como ejecutado».

## 11. Resumen de comandos

```bash
sudo apt update
sudo apt install bind9 bind9utils dnsutils -y
sudo cp /etc/bind/named.conf.options /etc/bind/named.conf.options.bak
sudo nano /etc/bind/named.conf.options
sudo nano /etc/bind/named.conf.local
sudo mkdir -p /etc/bind/zones
sudo tee /etc/bind/zones/db.rutabol.test > /dev/null <<'EOF'
$TTL 3600
@   IN  SOA ns.rutabol.test. hostmaster.rutabol.test. (
        2026112501 ; serial (AAAAMMDDnn)
        3600       ; refresh
        900        ; retry
        604800     ; expire
        300        ; negative cache TTL
)

@       IN  NS   ns.rutabol.test.
ns      IN  A    127.0.0.1
www     IN  A    127.0.0.1
mail    IN  A    127.0.0.1
api     IN  CNAME www.rutabol.test.
@       IN  MX   10 mail.rutabol.test.
EOF
sudo named-checkconf
sudo named-checkzone rutabol.test /etc/bind/zones/db.rutabol.test
sudo systemctl enable --now bind9
systemctl status bind9 --no-pager
dig @127.0.0.1 www.rutabol.test A
dig @127.0.0.1 api.rutabol.test CNAME
dig @127.0.0.1 rutabol.test MX
nslookup www.rutabol.test 127.0.0.1
journalctl -u bind9 -n 20 --no-pager
```

**Recordatorio final:** este DNS local `.test` no publica la aplicación en Internet, no sustituye HTTPS/Caddy ni un proxy inverso; solo permite practicar la resolución de nombres dentro del laboratorio.
