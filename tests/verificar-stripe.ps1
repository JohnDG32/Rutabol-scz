$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backend = Join-Path $root 'backend'
$basePrincipal = 'http://localhost:3001/api'
$baseAislada = 'http://localhost:3011/api'
$puertoAislado = 3011
$claveFalsa = 'sk_test_verificacion_local_123456789'

$envLines = Get-Content (Join-Path $root 'backend\.env')
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

$script:base = $basePrincipal
$sesiones = @{}
$resultados = @()
$proc = $null
$pagoCreado = $null
$viajeCreado = $null

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
  Write-Host '== 1. El modo simulado sigue intacto =='
  $cfg = Req 'GET' '/pagos/config' $null
  Chequear 'La API principal sigue en modo SIMULADO' ($cfg.code -eq 200 -and $cfg.data.modo -eq 'SIMULADO') "modo=$($cfg.data.modo)"

  Write-Host '== 2. Esquema de base preparado =='
  $sql = @"
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'pagos'::regclass AND conname = 'pagos_metodo_check'
    AND pg_get_constraintdef(oid) LIKE '%STRIPE%'
) AND EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'pagos' AND column_name = 'stripe_sesion_id'
) THEN 't' ELSE 'f' END;
"@
  $esquema = (& docker compose exec -T postgres psql -U micros -d micros_scz -tAc $sql).Trim()
  Chequear 'CHECK acepta STRIPE y existe stripe_sesion_id' ($esquema -eq 't') "valor=$esquema"

  Write-Host '== 3. API aislada con clave de prueba invalida =='
  $originales = @{
    PORT = $env:PORT
    PAGOS_MODO = $env:PAGOS_MODO
    STRIPE_SECRET_KEY = $env:STRIPE_SECRET_KEY
  }
  $salida = Join-Path $env:TEMP 'rutabol-stripe-out.log'
  $errores = Join-Path $env:TEMP 'rutabol-stripe-err.log'
  $env:PORT = "$puertoAislado"
  $env:PAGOS_MODO = 'STRIPE'
  $env:STRIPE_SECRET_KEY = $claveFalsa
  try {
    $proc = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory $backend -PassThru `
      -RedirectStandardOutput $salida -RedirectStandardError $errores -WindowStyle Hidden
  } finally {
    $env:PORT = $originales.PORT
    $env:PAGOS_MODO = $originales.PAGOS_MODO
    $env:STRIPE_SECRET_KEY = $originales.STRIPE_SECRET_KEY
  }

  $listo = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $sondeo = Invoke-RestMethod -Uri "$baseAislada/pagos/config" -TimeoutSec 2
      if ($sondeo.modo -eq 'STRIPE') { $listo = $true; break }
    } catch { }
  }
  Chequear 'La API aislada arranco en modo STRIPE' $listo "log=$errores"
  if (-not $listo) { throw 'No se pudo iniciar la API aislada' }

  $script:base = $baseAislada
  $cfgAislada = Req 'GET' '/pagos/config' $null
  Chequear 'El frontend puede detectar modo y moneda' (
    $cfgAislada.code -eq 200 -and $cfgAislada.data.modo -eq 'STRIPE' -and $cfgAislada.data.moneda -eq 'usd'
  ) "modo=$($cfgAislada.data.modo) moneda=$($cfgAislada.data.moneda)"

  $null = Login 'conductor1' $demoPass 'conductorAislado'
  $activos = Req 'GET' '/viajes/activos' $null 'conductorAislado'
  if ($activos.code -eq 200 -and @($activos.data).Count -gt 0) {
    $viajeId = [int]$activos.data[0].id
  } else {
    $nuevoViaje = Req 'POST' '/viajes' @{ microId = 1 } 'conductorAislado'
    if ($nuevoViaje.code -eq 201) { $viajeCreado = [int]$nuevoViaje.data.id }
    $viajeId = $viajeCreado
  }
  Chequear 'Hay un viaje en curso para pagar' ($viajeId -gt 0) "viaje=$viajeId"

  $null = Login 'pasajero1' $demoPass 'pasajeroAislado'
  $pago = Req 'POST' '/pagos' @{ viajeId = $viajeId; categoria = 'GENERAL'; token = 'TOKEN-DEMO' } 'pasajeroAislado'
  $pagoCreado = if ($pago.code -eq 201) { $pago.data } else { $null }
  Chequear 'El pago se crea con metodo STRIPE y referencia STR' (
    $pago.code -eq 201 -and $pago.data.metodo -eq 'STRIPE' -and $pago.data.referencia -like 'STR-*'
  ) "code=$($pago.code) metodo=$($pago.data.metodo) referencia=$($pago.data.referencia)"

  if ($pagoCreado) {
    $checkout = Req 'POST' "/pagos/$($pagoCreado.id)/checkout" $null 'pasajeroAislado'
    $logStripe = if (Test-Path $errores) { [string](Get-Content -Raw $errores) } else { '' }
    $evidencia = if ($logStripe.Length -gt 180) { $logStripe.Substring(0, 180) } else { $logStripe }
    Chequear 'Se llama a Stripe y el error vuelve controlado (400)' (
      $checkout.code -eq 400 -and $logStripe -match '\[Stripe\]'
    ) "code=$($checkout.code) log=$evidencia"

    $estado = Req 'GET' "/pagos/$($pagoCreado.id)" $null 'pasajeroAislado'
    Chequear 'El pago queda pendiente y sin session id' (
      $estado.code -eq 200 -and $estado.data.estado -eq 'PENDIENTE' -and -not $estado.data.stripeSesionId
    ) "estado=$($estado.data.estado)"

    $confirm = Req 'POST' "/pagos/$($pagoCreado.id)/confirmar" $null 'pasajeroAislado'
    Chequear 'La confirmacion simulada rechaza pagos STRIPE' ($confirm.code -eq 400) "code=$($confirm.code)"
  }

  $script:base = $basePrincipal
  $cfgFinal = Req 'GET' '/pagos/config' $null
  Chequear 'La instancia principal no fue afectada' (
    $cfgFinal.code -eq 200 -and $cfgFinal.data.modo -eq 'SIMULADO'
  ) "modo=$($cfgFinal.data.modo)"
}
finally {
  if ($proc) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
  if ($pagoCreado) {
    & docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
      -c "DELETE FROM pagos WHERE id = $($pagoCreado.id);" 2>&1 | Out-Null
  }
  if ($viajeCreado) {
    & docker compose exec -T postgres psql -U micros -d micros_scz -v ON_ERROR_STOP=1 `
      -c "DELETE FROM viajes WHERE id = $viajeCreado;" 2>&1 | Out-Null
  }
}

$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' }).Count
Write-Host ''
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos)  FAIL: $fallos"
if ($fallos -gt 0) { exit 1 }
