$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$envLines = Get-Content (Join-Path $root 'backend\.env')
$adminPass = ($envLines | Where-Object { $_ -like 'ADMIN_PASSWORD=*' }) -replace '^ADMIN_PASSWORD=',''
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

# La prueba se limpia antes y despues para poder ejecutarla las veces que sea sin datos huerfanos.
function Limpiar-DatosDePrueba {
  docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
    -c "TRUNCATE TABLE trasbordos, abordajes, pagos, viajes, notificaciones, auditoria, posiciones RESTART IDENTITY CASCADE;" `
    -c "DELETE FROM micros WHERE interno LIKE 'QA%';" `
    -c "UPDATE micros SET estado = CASE WHEN autorizado THEN 'DISPONIBLE' ELSE 'FUERA_DE_SERVICIO' END;" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo limpiar la base de prueba' }
}

Write-Host '== 0. Limpieza inicial =='
Limpiar-DatosDePrueba

$sesiones = @{}
$resultados = @()

function Req($method, $path, $body, $quien = $null) {
  $splat = @{
    Method = $method
    Uri = "$base$path"
    ContentType = 'application/json'
    TimeoutSec = 20
    UseBasicParsing = $true
  }
  if ($null -ne $body) { $splat.Body = ($body | ConvertTo-Json -Compress -Depth 10) }
  if ($quien) { $splat.WebSession = $sesiones[$quien] }
  try {
    $resp = Invoke-WebRequest @splat
    $codigo = [int]$resp.StatusCode
    $datos = if ($resp.Content) {
      if ($resp.Headers['Content-Type'] -match 'json') { $resp.Content | ConvertFrom-Json } else { $resp.Content }
    } else { $null }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $codigo = [int]$resp.StatusCode
      $stream = $resp.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $contenido = $reader.ReadToEnd()
        $datos = try { $contenido | ConvertFrom-Json } catch { $null }
      } else { $datos = $null }
    } else { throw }
  }
  return @{ code = $codigo; data = $datos }
}

function Chequear($nombre, $condicion, $detalle = '') {
  $estado = if ($condicion) { 'PASS' } else { 'FAIL' }
  $script:resultados += [pscustomobject]@{ Prueba = $nombre; Resultado = $estado; Detalle = $detalle }
  if (-not $condicion) { Write-Host "FAIL: $nombre - $detalle" -ForegroundColor Red }
}

function Login($usuario, $clave, $claveSesion) {
  $r = Invoke-WebRequest -Uri "$base/auth/login" -Method POST -ContentType 'application/json' `
    -Body (@{ username = $usuario; password = $clave } | ConvertTo-Json -Compress) `
    -SessionVariable nuevaSesion -UseBasicParsing -TimeoutSec 20
  $sesiones[$claveSesion] = $nuevaSesion
  return $r.Content | ConvertFrom-Json
}

Write-Host '== A. Catalogo publico y seguridad =='
$r = Req 'GET' '/lineas'
Chequear 'GET /lineas publico' ($r.code -eq 200 -and $r.data.Count -ge 4) "code=$($r.code)"
$r = Req 'GET' '/micros'
$estadosValidos = @('DISPONIBLE','EN_CIRCULACION','LLENO','FUERA_DE_SERVICIO','EMERGENCIA')
Chequear 'Estados RF-24 en /micros' (@($r.data | Where-Object { $estadosValidos -notcontains $_.estado }).Count -eq 0) (($r.data | ForEach-Object { $_.estado }) -join ',')
foreach ($path in @('/reportes/resumen','/pagos/mios','/viajes/historial')) {
  $r = Req 'GET' $path
  Chequear "Sin sesion: $path" ($r.code -eq 401 -or $r.code -eq 403) "code=$($r.code)"
}
$r = Req 'POST' '/auth/login' @{ username = 'admin'; password = 'clave-incorrecta' }
Chequear 'Login con clave incorrecta' ($r.code -eq 401) "code=$($r.code)"

Write-Host '== B. Login por roles =='
$admin = Login 'admin' $adminPass 'admin'
Chequear 'Login ADMIN' ($admin.rol -eq 'ADMIN') "rol=$($admin.rol)"

# Preparación: retira micros de pruebas anteriores y deja disponible el micro demo 1.
$previos = Req 'GET' '/micros' $null 'admin'
foreach ($microPrevio in @($previos.data | Where-Object { $_.interno -like 'QA*' })) {
  $null = Req 'DELETE' "/micros/$($microPrevio.id)" $null 'admin'
}
$null = Req 'PATCH' '/micros/1' @{ placa='DEMO-001'; interno='101'; capacidad=25; estado='DISPONIBLE'; autorizado=$true; lineaId=1 } 'admin'

$conductor = Login 'conductor1' $demoPass 'conductor'
Chequear 'Login CONDUCTOR' ($conductor.rol -eq 'CONDUCTOR') "rol=$($conductor.rol)"
$pasa = Login 'pasajero1' $demoPass 'pasajero'
Chequear 'Login PASAJERO' ($pasa.rol -eq 'PASAJERO') "rol=$($pasa.rol)"
$estu = Login 'estudiante1' $demoPass 'estudiante'
Chequear 'Login ESTUDIANTE' ($estu.rol -eq 'ESTUDIANTE') "rol=$($estu.rol)"

Write-Host '== C. Administracion y reglas de capacidad =='
$r = Req 'GET' '/reportes/resumen' $null 'admin'
Chequear 'Reporte solo ADMIN' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'POST' '/micros' @{ placa='QA-26'; interno='QA26'; capacidad=26; estado='DISPONIBLE'; autorizado=$true; lineaId=1 } 'admin'
Chequear 'Capacidad 26 rechazada' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'POST' '/micros' @{ placa='QA-18'; interno='QA18'; capacidad=18; estado='DISPONIBLE'; autorizado=$true; lineaId=1 } 'admin'
Chequear 'Micro de prueba cap. 18 creado' ($r.code -eq 201) "code=$($r.code)"
$micro18 = $r.data.id
$r = Req 'POST' '/micros' @{ placa='QA-19'; interno='QA19'; capacidad=19; estado='DISPONIBLE'; autorizado=$true; lineaId=1 } 'admin'
Chequear 'Micro de prueba cap. 19 creado' ($r.code -eq 201) "code=$($r.code)"
$micro19 = $r.data.id
$r = Req 'POST' '/micros' @{ placa='QA-NO'; interno='QANO'; capacidad=20; estado='DISPONIBLE'; autorizado=$false; lineaId=1 } 'admin'
Chequear 'Micro no autorizado creado' ($r.code -eq 201) "code=$($r.code)"
$microNo = $r.data.id

Write-Host '== D. Operacion del conductor =='
$r = Req 'GET' '/conductores/yo' $null 'conductor'
Chequear 'Conductor asociado a su usuario' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'POST' '/viajes' @{ microId = $microNo } 'conductor'
Chequear 'Viaje con micro no autorizado rechazado' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'POST' '/viajes' @{ microId = 1 } 'conductor'
Chequear 'Iniciar viaje en micro 1' ($r.code -eq 201) "code=$($r.code)"
$viajeA = $r.data.id
$r = Req 'GET' '/viajes/activos' $null 'conductor'
Chequear 'Viaje activo listado' ($r.code -eq 200 -and @($r.data | Where-Object { $_.id -eq $viajeA }).Count -eq 1) "code=$($r.code)"

Write-Host '== E. GPS simulado y micros cercanos =='
$r = Req 'POST' '/micros/1/posicion' @{ lat = -17.7833; lng = -63.1821 } 'conductor'
Chequear 'Registrar posicion GPS' (($r.code -eq 200 -or $r.code -eq 201)) "code=$($r.code)"
$r = Req 'GET' '/micros/cercanos?lat=-17.7833&lng=-63.1821&radio=5'
Chequear 'Micro cercano dentro de 5 km' ($r.code -eq 200 -and @($r.data | Where-Object { $_.id -eq 1 }).Count -eq 1) "code=$($r.code) datos=$($r.data.Count)"
$r = Req 'GET' '/micros/cercanos?lat=-16.5&lng=-68.15&radio=5'
Chequear 'Micro lejano filtrado' ($r.code -eq 200 -and @($r.data | Where-Object { $_.id -eq 1 }).Count -eq 0) "code=$($r.code)"

Write-Host '== F. Estudiantes y tarifas =='
$r = Req 'GET' '/estudiantes/yo' $null 'estudiante'
Chequear 'Estudiante asociado a su usuario' ($r.code -eq 200 -and $r.data.verificado) "code=$($r.code)"
$codigoEst = $r.data.codigo
$fotoEst = $r.data.fotoUrl
$r = Req 'POST' '/estudiantes/validar' @{ categoria='UNIVERSITARIO'; codigo=$codigoEst; fotoUrl=$fotoEst } 'conductor'
Chequear 'Validar estudiante por codigo y foto' (($r.code -eq 200 -or $r.code -eq 201) -and $r.data.valido) "code=$($r.code)"
$r = Req 'POST' '/pagos' @{ viajeId=$viajeA; categoria='ESCOLAR'; token='TOKEN-DEMO' } 'pasajero'
Chequear 'Tarifa escolar a pasajero no estudiante rechazada' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'POST' '/pagos' @{ viajeId=$viajeA; categoria='UNIVERSITARIO'; token='TOKEN-DEMO' } 'estudiante'
Chequear 'Pago universitario a estudiante verificado' ($r.code -eq 201 -and [double]$r.data.monto -eq 1.8) "code=$($r.code) monto=$($r.data.monto)"

Write-Host '== G. Pago confirmado y abordaje =='
$r = Req 'POST' '/pagos' @{ viajeId=$viajeA; categoria='GENERAL'; token='TOKEN-DEMO' } 'pasajero'
Chequear 'Crear pago general' ($r.code -eq 201 -and $r.data.estado -eq 'PENDIENTE') "code=$($r.code) estado=$($r.data.estado)"
$pagoA = $r.data.id
$r = Req 'POST' "/viajes/$viajeA/abordar" @{ pagoId=$pagoA; categoria='GENERAL' } 'conductor'
Chequear 'Abordaje con pago pendiente rechazado' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'POST' "/pagos/$pagoA/confirmar" $null 'pasajero'
Chequear 'Confirmar pago en pasarela simulada' (($r.code -eq 200 -or $r.code -eq 201) -and $r.data.estado -eq 'CONFIRMADO') "code=$($r.code)"
$r = Req 'POST' "/viajes/$viajeA/abordar" @{ pagoId=$pagoA; categoria='GENERAL' } 'conductor'
Chequear 'Abordaje con pago confirmado' ($r.code -eq 201 -and $r.data.ocupacion -eq 1) "code=$($r.code) ocupacion=$($r.data.ocupacion)"
$abordajeA = $r.data.abordaje.id

Write-Host '== H. Trasbordo sin doble cobro =='
$r = Req 'GET' '/pagos/mios' $null 'pasajero'
$pagosAntes = $r.data.Count
$r = Req 'POST' "/viajes/$viajeA/trasbordo" @{ microDestinoId=3; abordajeIds=@($abordajeA) } 'conductor'
Chequear 'Trasbordo a otra linea rechazado' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'POST' "/viajes/$viajeA/trasbordo" @{ microDestinoId=$micro18; abordajeIds=@($abordajeA) } 'conductor'
Chequear 'Trasbordo a micro de la misma linea' ($r.code -eq 201 -and $r.data.trasbordos.Count -eq 1) "code=$($r.code)"
$viajeB = $r.data.viajeDestino.id
$reutilizado = if ($r.data -and $r.data.trasbordos -and $r.data.trasbordos.Count -gt 0) { $r.data.trasbordos[0].pagoReutilizado } else { $null }
Chequear 'Trasbordo marca pago reutilizado' ($reutilizado -eq $true) "valor=$reutilizado"
$r = Req 'GET' '/pagos/mios' $null 'pasajero'
Chequear 'Trasbordo no genera otro pago' ($r.data.Count -eq $pagosAntes) "antes=$pagosAntes despues=$($r.data.Count)"

Write-Host '== I. Emergencia y notificaciones =='
$r = Req 'POST' '/pagos' @{ viajeId=$viajeA; categoria='GENERAL'; token='TOKEN-DEMO' } 'pasajero'
$pagoEmerg = $r.data.id
$r = Req 'POST' "/pagos/$pagoEmerg/confirmar" $null 'pasajero'
$r = Req 'POST' "/viajes/$viajeA/abordar" @{ pagoId=$pagoEmerg; categoria='GENERAL' } 'conductor'
$abordajeEmerg = $r.data.abordaje.id
$r = Req 'POST' "/viajes/$viajeA/emergencia" @{ microDestinoId=$micro19; motivo='Falla mecanica demostrativa'; abordajeIds=@($abordajeEmerg) } 'conductor'
Chequear 'Trasbordo de emergencia' ($r.code -eq 201 -and $r.data.notificaciones -eq 2) "code=$($r.code)"
$r = Req 'GET' '/notificaciones' $null 'pasajero'
Chequear 'Pasajero recibe aviso de emergencia' (@($r.data | Where-Object { $_.tipo -eq 'EMERGENCIA' }).Count -ge 1) "notificaciones=$($r.data.Count)"
$r = Req 'GET' '/micros'
Chequear 'Micro en emergencia cambia de estado' (@($r.data | Where-Object { $_.id -eq 1 -and $_.estado -eq 'EMERGENCIA' }).Count -eq 1) "code=$($r.code)"

Write-Host '== J. Limite de capacidad =='
for ($i = 1; $i -le 17; $i++) {
  $p = Req 'POST' '/pagos' @{ viajeId=$viajeB; categoria='GENERAL'; token='TOKEN-DEMO' } 'pasajero'
  if ($p.code -ne 201) { Chequear "Pago llenado $i" $false "code=$($p.code)"; break }
  $c = Req 'POST' "/pagos/$($p.data.id)/confirmar" $null 'pasajero'
  if ($c.code -ne 200 -and $c.code -ne 201) { Chequear "Confirmacion llenado $i" $false "code=$($c.code)"; break }
  $a = Req 'POST' "/viajes/$viajeB/abordar" @{ pagoId=$p.data.id; categoria='GENERAL' } 'conductor'
  if ($a.code -ne 201) { Chequear "Abordaje llenado $i" $false "code=$($a.code) detalle=$($a.data.message)"; break }
}
$r = Req 'POST' '/pagos' @{ viajeId=$viajeB; categoria='GENERAL'; token='TOKEN-DEMO' } 'pasajero'
$pagoExcedente = $r.data.id
$r = Req 'POST' "/pagos/$pagoExcedente/confirmar" $null 'pasajero'
$r = Req 'POST' "/viajes/$viajeB/abordar" @{ pagoId=$pagoExcedente; categoria='GENERAL' } 'conductor'
Chequear 'Abordaje por encima de capacidad rechazado (409)' ($r.code -eq 409) "code=$($r.code) detalle=$($r.data.message)"
$r = Req 'GET' '/micros'
Chequear 'Micro lleno cambia a estado LLENO' (@($r.data | Where-Object { $_.id -eq $micro18 -and $_.estado -eq 'LLENO' }).Count -eq 1) "code=$($r.code)"
$r = Req 'GET' '/notificaciones' $null 'admin'
Chequear 'Alerta de capacidad notificada a ADMIN' (@($r.data | Where-Object { $_.tipo -eq 'CAPACIDAD' }).Count -ge 1) "notificaciones=$($r.data.Count)"

Write-Host '== K. Historial y reportes =='
$r = Req 'GET' '/viajes/historial' $null 'pasajero'
Chequear 'Historial de pasajero' ($r.code -eq 200 -and $r.data.viajes.Count -ge 1 -and $r.data.trasbordos.Count -ge 1) "viajes=$($r.data.viajes.Count) trasbordos=$($r.data.trasbordos.Count)"
$r = Req 'GET' '/reportes/resumen' $null 'admin'
Chequear 'Reporte con datos' ($r.code -eq 200 -and $r.data.pagos.confirmados -ge 1 -and $r.data.trasbordos -ge 1 -and $r.data.emergencias -ge 1) "pagos=$($r.data.pagos.confirmados) trasbordos=$($r.data.trasbordos) emergencias=$($r.data.emergencias)"

$r = Req 'GET' '/reportes/resumen?lineaId=1' $null 'admin'
Chequear 'Reporte filtrado por línea' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'GET' '/reportes/resumen?desde=fecha-invalida' $null 'admin'
Chequear 'Filtro de fecha inválido rechazado' ($r.code -eq 400) "code=$($r.code)"
$r = Req 'GET' '/reportes/exportar?lineaId=1' $null 'admin'
Chequear 'Exportación CSV' ($r.code -eq 200) "code=$($r.code)"

Write-Host '== L. Limpieza de viajes de prueba =='
Limpiar-DatosDePrueba
$r = Req 'GET' '/micros'
Write-Host "Estados finales: $((@($r.data) | ForEach-Object { "$($_.interno)=$($_.estado)" }) -join ', ')"

Write-Host ''
Write-Host '===== RESUMEN ====='
$resultados | Format-Table -AutoSize
$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' })
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos.Count)  FAIL: $($fallos.Count)"
Write-Host "IDs de prueba: micro18=$micro18 micro19=$micro19 microNo=$microNo viajeA=$viajeA viajeB=$viajeB pagoA=$pagoA abordajeA=$abordajeA"
if ($fallos.Count -gt 0) { exit 1 }
