$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$envLines = Get-Content (Join-Path $root 'backend\.env')
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

$lat = -17.7833
$lng = -63.1821
$resultados = @()

function Chequear($nombre, $condicion, $detalle = '') {
  $estado = if ($condicion) { 'PASS' } else { 'FAIL' }
  $script:resultados += [pscustomobject]@{ Prueba = $nombre; Resultado = $estado; Detalle = $detalle }
  Write-Host "$estado : $nombre $detalle"
}

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ username = 'conductor1'; password = $demoPass } | ConvertTo-Json -Compress) `
  -SessionVariable sesion -UseBasicParsing -TimeoutSec 20

$micros = Invoke-RestMethod -Uri "$base/micros" -UseBasicParsing -TimeoutSec 20
$micro = @($micros | Where-Object { $_.interno -eq '101' })[0]
if (-not $micro) { throw 'No se encontro el micro de demostracion 101' }

Write-Host '== GPS real del navegador (origen explicito) =='
$posicion = Invoke-RestMethod -Uri "$base/micros/$($micro.id)/posicion" -Method POST -ContentType 'application/json' `
  -Body (@{ lat = $lat; lng = $lng; origen = 'GPS_NAVEGADOR' } | ConvertTo-Json -Compress) `
  -WebSession $sesion -UseBasicParsing -TimeoutSec 20
Chequear 'La API guarda el origen GPS_NAVEGADOR' ($posicion.origen -eq 'GPS_NAVEGADOR') "origen=$($posicion.origen)"

$cercanos = Invoke-RestMethod -Uri "$base/micros/cercanos?lat=$lat&lng=$lng&radio=5" -UseBasicParsing -TimeoutSec 20
$encontrado = @($cercanos | Where-Object { $_.id -eq $micro.id })[0]
Chequear 'Micros cercanos muestra la etiqueta GPS real' ($encontrado -and $encontrado.origen -eq 'GPS_NAVEGADOR') "origen=$($encontrado.origen)"

Write-Host '== Compatibilidad con coordenadas manuales (sin origen) =='
$manual = Invoke-RestMethod -Uri "$base/micros/$($micro.id)/posicion" -Method POST -ContentType 'application/json' `
  -Body (@{ lat = $lat; lng = $lng } | ConvertTo-Json -Compress) `
  -WebSession $sesion -UseBasicParsing -TimeoutSec 20
Chequear 'El origen por defecto sigue siendo SIMULADO' ($manual.origen -eq 'SIMULADO') "origen=$($manual.origen)"

$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' }).Count
Write-Host ''
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos)  FAIL: $fallos"
if ($fallos -gt 0) { exit 1 }
