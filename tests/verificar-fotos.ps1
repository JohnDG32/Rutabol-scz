$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$envLines = Get-Content (Join-Path $root 'backend\.env')
$adminPass = ($envLines | Where-Object { $_ -like 'ADMIN_PASSWORD=*' }) -replace '^ADMIN_PASSWORD=',''
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
$demoPass = if ($demoLine) { $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' } else { 'RutabolDemo123' }

$png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
$dataUrl = "data:image/png;base64,$png"
$prefijo = 'QA-FOTO-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$resultados = @()
$creado = $null

function Chequear($nombre, $condicion, $detalle = '') {
  $estado = if ($condicion) { 'PASS' } else { 'FAIL' }
  $script:resultados += [pscustomobject]@{ Prueba = $nombre; Resultado = $estado; Detalle = $detalle }
  Write-Host "$estado : $nombre $detalle"
}

$admin = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ username = 'admin'; password = $adminPass } | ConvertTo-Json -Compress) `
  -SessionVariable sesionAdmin -UseBasicParsing -TimeoutSec 20

$conductor = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ username = 'conductor1'; password = $demoPass } | ConvertTo-Json -Compress) `
  -SessionVariable sesionConductor -UseBasicParsing -TimeoutSec 20

try {
  Write-Host '== Fotografias fuera de la base de datos =='
  $creado = Invoke-RestMethod -Uri "$base/estudiantes" -Method POST -ContentType 'application/json' `
    -Body (@{
      nombre = 'Foto'; apellido = 'Prueba'; ci = $prefijo; categoria = 'ESCOLAR';
      codigo = $prefijo; fotoUrl = $dataUrl
    } | ConvertTo-Json -Compress) -WebSession $sesionAdmin -UseBasicParsing -TimeoutSec 20
  Chequear 'El alta guarda una URL de archivo, no una data URL' ($creado.fotoUrl -like '/uploads/fotos/*') "url=$($creado.fotoUrl)"

  $archivo = Join-Path $root "backend\uploads\fotos\$(Split-Path $creado.fotoUrl -Leaf)"
  Chequear 'El archivo existe en disco' (Test-Path $archivo) "archivo=$(Split-Path $creado.fotoUrl -Leaf)"

  $codigoHttp = & curl.exe --ssl-no-revoke -s -o NUL -w '%{http_code}' "https://www.rutabol.test$($creado.fotoUrl)"
  Chequear 'La foto se sirve por HTTPS' ($codigoHttp -eq '200') "http=$codigoHttp"

  Invoke-RestMethod -Uri "$base/estudiantes/$($creado.id)/verificar" -Method POST `
    -WebSession $sesionAdmin -UseBasicParsing -TimeoutSec 20 | Out-Null
  $validar = Invoke-RestMethod -Uri "$base/estudiantes/validar" -Method POST -ContentType 'application/json' `
    -Body (@{ categoria = 'ESCOLAR'; codigo = $prefijo; fotoUrl = $creado.fotoUrl } | ConvertTo-Json -Compress) `
    -WebSession $sesionConductor -UseBasicParsing -TimeoutSec 20
  Chequear 'La validacion funciona con la URL guardada' ($validar.valido) "valido=$($validar.valido)"

  $dataUrls = & docker compose exec -T postgres psql -U micros -d micros_scz -tAc `
    "SELECT count(*) FROM estudiantes WHERE foto_url LIKE 'data:image/%';"
  Chequear 'PostgreSQL no conserva data URLs' ($dataUrls.Trim() -eq '0') "dataUrls=$($dataUrls.Trim())"
}
finally {
  if ($creado) {
    Invoke-RestMethod -Uri "$base/estudiantes/$($creado.id)" -Method DELETE `
      -WebSession $sesionAdmin -UseBasicParsing -TimeoutSec 20 | Out-Null
  }
}

$fallos = @($resultados | Where-Object { $_.Resultado -eq 'FAIL' }).Count
Write-Host ''
Write-Host "TOTAL: $($resultados.Count)  PASS: $($resultados.Count - $fallos)  FAIL: $fallos"
if ($fallos -gt 0) { exit 1 }
