$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backend = Join-Path $root 'backend'
$baseAislada = 'http://localhost:3013/api'
$puertoAislado = 3013

$envLines = Get-Content (Join-Path $backend '.env')
$adminLine = $envLines | Where-Object { $_ -like 'ADMIN_USERNAME=*' }
$adminUser = if ($adminLine) { $adminLine -replace '^ADMIN_USERNAME=','' } else { 'admin' }
$adminLine = $envLines | Where-Object { $_ -like 'ADMIN_PASSWORD=*' }
$adminPass = if ($adminLine) { $adminLine -replace '^ADMIN_PASSWORD=','' } else { '' }
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

$nombrePrueba = 'qa_usuario_' + (Get-Date -Format 'yyyyMMddHHmmss')
$claveInicial = 'ClaveQa2026Segura'
$claveNueva = 'ClaveQa2026Nueva'

$script:base = $baseAislada
$sesiones = @{}
$resultados = @()
$proc = $null
$creado = $null

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
  Write-Host '== 1. Migración aplicada =='
  $columnas = (& docker compose exec -T postgres psql -U micros -d micros_scz -tAc `
    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='usuarios' AND column_name='activo';").Trim()
  Chequear 'La columna usuarios.activo existe' ($columnas -eq '1') "columnas=$columnas"

  Write-Host '== 2. API aislada =='
  $original = $env:PORT
  $salida = Join-Path $env:TEMP 'rutabol-usuarios-out.log'
  $errores = Join-Path $env:TEMP 'rutabol-usuarios-err.log'
  $env:PORT = "$puertoAislado"
  try {
    $proc = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory $backend -PassThru `
      -RedirectStandardOutput $salida -RedirectStandardError $errores -WindowStyle Hidden
  } finally {
    $env:PORT = $original
  }

  $listo = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $sondeo = Invoke-RestMethod -Uri "$baseAislada/lineas" -TimeoutSec 2
      if ($sondeo) { $listo = $true; break }
    } catch { }
  }
  Chequear 'La API aislada arrancó en el puerto 3013' $listo "log=$errores"
  if (-not $listo) { throw 'No se pudo iniciar la API aislada' }

  Write-Host '== 3. Acceso por rol =='
  $anonimo = Req 'GET' '/usuarios' $null
  Chequear 'Sin sesión no se puede listar usuarios (401)' ($anonimo.code -eq 401) "code=$($anonimo.code)"

  $pasajero = Login 'pasajero1' $demoPass 'pasajero'
  $prohibido = Req 'GET' '/usuarios' $null 'pasajero'
  Chequear 'Un pasajero no puede listar usuarios (403)' ($prohibido.code -eq 403) "code=$($prohibido.code)"

  $admin = Login $adminUser $adminPass 'admin'
  $lista = Req 'GET' '/usuarios' $null 'admin'
  $visibles = @($lista.data)
  $demoActivos = @($visibles | Where-Object { $_.username -in @('admin','conductor1','pasajero1','estudiante1') -and $_.activo -eq $true }).Count
  Chequear 'El administrador ve los cuatro usuarios demo activos' (
    $lista.code -eq 200 -and $demoActivos -eq 4
  ) "code=$($lista.code) visibles=$($visibles.Count) activos=$demoActivos"

  Write-Host '== 4. Alta de usuario =='
  $alta = Req 'POST' '/usuarios' @{
    username = $nombrePrueba; password = $claveInicial; rol = 'CONDUCTOR'; activo = $true
  } 'admin'
  $creado = if ($alta.code -eq 201) { $alta.data } else { $null }
  $sinHash = $creado -and ($creado.PSObject.Properties.Name -notcontains 'password_hash') -and
    ($creado.PSObject.Properties.Name -notcontains 'password')
  Chequear 'Alta con rol y respuesta sin hash' (
    $alta.code -eq 201 -and $creado.rol -eq 'CONDUCTOR' -and $creado.activo -eq $true -and $sinHash
  ) "code=$($alta.code) rol=$($creado.rol) sinHash=$sinHash"

  $nuevo = Login $nombrePrueba $claveInicial 'nuevo'
  Chequear 'El usuario creado puede iniciar sesión' (
    $nuevo.username -eq $nombrePrueba -and $nuevo.rol -eq 'CONDUCTOR'
  ) "usuario=$($nuevo.username) rol=$($nuevo.rol)"

  Write-Host '== 5. Cambio de rol y baja =='
  $cambio = Req 'PATCH' "/usuarios/$($creado.id)" @{
    username = $nombrePrueba; rol = 'PASAJERO'; activo = $false
  } 'admin'
  Chequear 'Editar rol y estado devuelve el usuario inactivo' (
    $cambio.code -eq 200 -and $cambio.data.rol -eq 'PASAJERO' -and $cambio.data.activo -eq $false
  ) "code=$($cambio.code) rol=$($cambio.data.rol) activo=$($cambio.data.activo)"

  try {
    $loginInactivo = Req 'POST' '/auth/login' @{ username = $nombrePrueba; password = $claveInicial } $null
  } catch { $loginInactivo = @{ code = 0 } }
  Chequear 'Un usuario inactivo no puede iniciar sesión' ($loginInactivo.code -eq 401) "code=$($loginInactivo.code)"

  $sesionVieja = Req 'GET' '/pagos/mios' $null 'nuevo'
  Chequear 'Una sesión viva pierde el acceso al desactivar (401)' ($sesionVieja.code -eq 401) "code=$($sesionVieja.code)"

  $reactivar = Req 'PATCH' "/usuarios/$($creado.id)" @{
    username = $nombrePrueba; rol = 'PASAJERO'; activo = $true; password = $claveNueva
  } 'admin'
  Chequear 'Reactivar y cambiar clave funciona' (
    $reactivar.code -eq 200 -and $reactivar.data.activo -eq $true
  ) "code=$($reactivar.code) activo=$($reactivar.data.activo)"

  $conNueva = Login $nombrePrueba $claveNueva 'nuevaClave'
  Chequear 'La clave nueva reemplaza a la anterior' ($conNueva.username -eq $nombrePrueba) "usuario=$($conNueva.username)"

  $propio = Req 'PATCH' "/usuarios/$($admin.id)" @{ activo = $false } 'admin'
  Chequear 'El admin no puede desactivarse a sí mismo (400)' ($propio.code -eq 400) "code=$($propio.code)"

  $baja = Req 'DELETE' "/usuarios/$($creado.id)" $null 'admin'
  $listaFinal = Req 'GET' '/usuarios' $null 'admin'
  $inactivo = @($listaFinal.data) | Where-Object { $_.id -eq $creado.id }
  Chequear 'La baja es lógica y conserva el registro' (
    $baja.code -eq 204 -and @($inactivo).Count -eq 1 -and $inactivo[0].activo -eq $false
  ) "code=$($baja.code) activo=$($inactivo[0].activo)"
}
finally {
  if ($proc) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
  & docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
    -c "DELETE FROM usuarios WHERE username = '$nombrePrueba';" 2>&1 | Out-Null
}

$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' }).Count
Write-Host ''
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos)  FAIL: $fallos"
if ($fallos -gt 0) { exit 1 }
