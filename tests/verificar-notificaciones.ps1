$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backend = Join-Path $root 'backend'
$basePrincipal = 'http://localhost:3001/api'
$baseAislada = 'http://localhost:3012/api'
$puertoAislado = 3012

# Claves VAPID generadas solo para esta verificación (nunca sirven para producción).
$vapidPublica = 'BB_DbmHpn1AZw9kTIJ_rdThOlmMyObdONkqMY2Llf7q76IjdfHlAmi4YYK4yaeXkLuEH6sO9nJ4BVpxwmz_PQ6s'
$vapidPrivada = 'SRX5tSzgqgRDsxKcP5ZZVnEwSK7lmTRfOSNwIaN_cIU'

$envLines = Get-Content (Join-Path $backend '.env')
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

$script:base = $basePrincipal
$sesiones = @{}
$resultados = @()
$proc = $null
$avisoCreado = $null
$endpointPrueba = 'https://fcm.googleapis.com/fcm/send/verificacion-local-rutabol'

function Req($method, $path, $body, $quien = $null) {
  $splat = @{
    Method = $method
    Uri = "$script:base$path"
    ContentType = 'application/json'
    TimeoutSec = 20
    UseBasicParsing = $true
  }
  if ($null -ne $body) { $splat.Body = ($body | ConvertTo-Json -Compress -Depth 10) }
  if ($quien) { $splat.WebSession = $sesiones[$quien] }
  try {
    $resp = Invoke-WebRequest @splat
    $codigo = [int]$resp.StatusCode
    $contenido = [string]$resp.Content
    $datos = if ($contenido) {
      if ($resp.Headers['Content-Type'] -match 'json') { $contenido | ConvertFrom-Json } else { $contenido }
    } else { $null }
  } catch {
    $resp = $_.Exception.Response
    $contenido = ''
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
  return @{ code = $codigo; data = $datos; raw = $contenido }
}

function Chequear($nombre, $condicion, $detalle = '') {
  $estado = if ($condicion) { 'PASS' } else { 'FAIL' }
  $script:resultados += [pscustomobject]@{ Prueba = $nombre; Resultado = $estado; Detalle = $detalle }
  $color = if ($condicion) { 'Green' } else { 'Red' }
  Write-Host "$estado : $nombre $detalle" -ForegroundColor $color
}

function Login($usuario, $clave, $claveSesion) {
  $r = Invoke-WebRequest -Uri "$script:base/auth/login" -Method POST -ContentType 'application/json' `
    -Body (@{ username = $usuario; password = $clave } | ConvertTo-Json -Compress) `
    -SessionVariable nuevaSesion -UseBasicParsing -TimeoutSec 20
  $sesiones[$claveSesion] = $nuevaSesion
  return $r.Content | ConvertFrom-Json
}

try {
  Write-Host '== 1. La configuración por defecto sigue intacta =='
  $cfg = Req 'GET' '/notificaciones/config' $null
  Chequear 'API principal sin push ni correo por defecto' (
    $cfg.code -eq 200 -and $cfg.data.push -eq $false -and $cfg.data.correo -eq 'DESACTIVADO'
  ) "push=$($cfg.data.push) correo=$($cfg.data.correo)"

  Write-Host '== 2. Esquema de base preparado =='
  $sql = "SELECT to_regclass('public.suscripciones_push') IS NOT NULL;"
  $esquema = (& docker compose exec -T postgres psql -U micros -d micros_scz -tAc $sql).Trim()
  Chequear 'Existe la tabla suscripciones_push' ($esquema -eq 't') "valor=$esquema"

  Write-Host '== 3. API aislada con push y correo configurados =='
  $originales = @{
    PORT = $env:PORT
    VAPID_PUBLIC_KEY = $env:VAPID_PUBLIC_KEY
    VAPID_PRIVATE_KEY = $env:VAPID_PRIVATE_KEY
    NOTIFICACIONES_EMAIL_MODO = $env:NOTIFICACIONES_EMAIL_MODO
    NOTIFICACIONES_EMAIL_DESTINO = $env:NOTIFICACIONES_EMAIL_DESTINO
  }
  $salida = Join-Path $env:TEMP 'rutabol-notif-out.log'
  $errores = Join-Path $env:TEMP 'rutabol-notif-err.log'
  $env:PORT = "$puertoAislado"
  $env:VAPID_PUBLIC_KEY = $vapidPublica
  $env:VAPID_PRIVATE_KEY = $vapidPrivada
  $env:NOTIFICACIONES_EMAIL_MODO = 'ARCHIVO'
  $env:NOTIFICACIONES_EMAIL_DESTINO = 'demo@rutabol.test'
  try {
    $proc = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory $backend -PassThru `
      -RedirectStandardOutput $salida -RedirectStandardError $errores -WindowStyle Hidden
  } finally {
    $env:PORT = $originales.PORT
    $env:VAPID_PUBLIC_KEY = $originales.VAPID_PUBLIC_KEY
    $env:VAPID_PRIVATE_KEY = $originales.VAPID_PRIVATE_KEY
    $env:NOTIFICACIONES_EMAIL_MODO = $originales.NOTIFICACIONES_EMAIL_MODO
    $env:NOTIFICACIONES_EMAIL_DESTINO = $originales.NOTIFICACIONES_EMAIL_DESTINO
  }

  $listo = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $sondeo = Invoke-RestMethod -Uri "$baseAislada/notificaciones/config" -TimeoutSec 2
      if ($sondeo.push -eq $true) { $listo = $true; break }
    } catch { }
  }
  Chequear 'La API aislada arrancó con push habilitado' $listo "log=$errores"
  if (-not $listo) { throw 'No se pudo iniciar la API aislada' }

  $script:base = $baseAislada
  $cfgAislada = Req 'GET' '/notificaciones/config' $null
  Chequear 'El frontend detecta push y correo ARCHIVO' (
    $cfgAislada.code -eq 200 -and $cfgAislada.data.push -eq $true -and
    $cfgAislada.data.correo -eq 'ARCHIVO' -and [bool]$cfgAislada.data.clavePublica
  ) "push=$($cfgAislada.data.push) correo=$($cfgAislada.data.correo)"

  $null = Login 'pasajero1' $demoPass 'pasajeroAislado'

  $mala = Req 'POST' '/notificaciones/suscribir' @{ endpoint = 'ftp://no-valido'; p256dh = 'x'; auth = 'y' } 'pasajeroAislado'
  Chequear 'Rechaza endpoints de push inválidos (400)' ($mala.code -eq 400) "code=$($mala.code)"

  $suscripcion = Req 'POST' '/notificaciones/suscribir' @{
    endpoint = $endpointPrueba
    p256dh = 'BNdR1x_ClaveDePruebaInvalidaParaPushLocalOnly'
    auth = 'claveAuthDePruebaLocal'
  } 'pasajeroAislado'
  $guardada = (& docker compose exec -T postgres psql -U micros -d micros_scz -tAc `
    "SELECT COUNT(*) FROM suscripciones_push WHERE endpoint = '$endpointPrueba';").Trim()
  Chequear 'La suscripción válida se guarda en PostgreSQL' (
    $suscripcion.code -eq 201 -and $suscripcion.data.guardada -eq $true -and [int]$guardada -ge 1
  ) "code=$($suscripcion.code) filas=$guardada"

  $directorioCorreos = Join-Path $backend 'uploads\correos'
  $antes = if (Test-Path $directorioCorreos) { @(Get-ChildItem $directorioCorreos -Filter '*.eml').Count } else { 0 }
  $aviso = Req 'POST' '/notificaciones/prueba' $null 'pasajeroAislado'
  $avisoCreado = if ($aviso.code -eq 201) { $aviso.data } else { $null }
  $lista = Req 'GET' '/notificaciones' $null 'pasajeroAislado'
  $enLista = @($lista.data) | Where-Object { $_.id -eq $avisoCreado.id }
  Chequear 'El aviso de prueba se crea y aparece en el panel' (
    $aviso.code -eq 201 -and $aviso.data.tipo -eq 'PRUEBA' -and @($enLista).Count -eq 1
  ) "code=$($aviso.code) tipo=$($aviso.data.tipo)"

  Start-Sleep -Milliseconds 800
  $despues = if (Test-Path $directorioCorreos) { @(Get-ChildItem $directorioCorreos -Filter '*.eml').Count } else { 0 }
  Chequear 'El modo ARCHIVO genera el correo .eml' ($despues -gt $antes) "antes=$antes despues=$despues"

  $logPush = if (Test-Path $errores) { [string](Get-Content -Raw $errores) } else { '' }
  $evidencia = if ($logPush.Length -gt 160) { $logPush.Substring(0, 160) } else { $logPush }
  Chequear 'Un push fallido no rompe la notificación interna' (
    $logPush -match '\[Push\]' -and $null -ne $avisoCreado
  ) "log=$evidencia"

  $script:base = $basePrincipal
  $cfgFinal = Req 'GET' '/notificaciones/config' $null
  Chequear 'La instancia principal no fue afectada' (
    $cfgFinal.code -eq 200 -and $cfgFinal.data.push -eq $false -and $cfgFinal.data.correo -eq 'DESACTIVADO'
  ) "push=$($cfgFinal.data.push) correo=$($cfgFinal.data.correo)"
}
finally {
  if ($proc) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
  if ($avisoCreado) {
    & docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
      -c "DELETE FROM notificaciones WHERE id = $($avisoCreado.id);" 2>&1 | Out-Null
  }
  & docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
    -c "DELETE FROM suscripciones_push WHERE endpoint = '$endpointPrueba';" 2>&1 | Out-Null
  $directorioCorreos = Join-Path $backend 'uploads\correos'
  if (Test-Path $directorioCorreos) {
    Get-ChildItem $directorioCorreos -Filter '*.eml' | Where-Object { $_.Name -like '*notificacion-*' } |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' }).Count
Write-Host ''
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos)  FAIL: $fallos"
if ($fallos -gt 0) { exit 1 }
