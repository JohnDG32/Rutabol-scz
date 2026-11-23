$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$origen = 'micros_scz'
$destino = 'micros_scz_restore_test'
$archivo = '/tmp/rutabol_restore_test.sql'
$tablas = @(
  'abordajes', 'auditoria', 'conductores', 'estudiantes', 'lineas', 'micros',
  'notificaciones', 'pagos', 'posiciones', 'session', 'tarifas', 'trasbordos',
  'usuarios', 'viajes'
)

function Invoke-Psql($base, $sql, $silencioso = $false) {
  if ($silencioso) {
    docker compose exec -T postgres psql -U micros -d $base -v ON_ERROR_STOP=1 -c $sql 2>&1 | Out-Null
    $salida = $null
  } else {
    $salida = docker compose exec -T postgres psql -U micros -d $base -tAc $sql
  }
  if ($LASTEXITCODE -ne 0) { throw "psql fallo en $base : $sql" }
  return $salida
}

try {
  Write-Host '== 1. Hacer pg_dump de la base real =='
  docker compose exec -T postgres pg_dump -U micros -d $origen -f $archivo 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump fallo' }

  Write-Host '== 2. Crear base vacia temporal =='
  $existe = Invoke-Psql 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$destino';"
  if ($existe -eq '1') { Invoke-Psql 'postgres' "DROP DATABASE $destino;" $true }
  Invoke-Psql 'postgres' "CREATE DATABASE $destino;" $true

  Write-Host '== 3. Restaurar el volcado en la base vacia =='
  docker compose exec -T postgres psql -U micros -d $destino -v ON_ERROR_STOP=1 -f $archivo 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'psql restore fallo' }

  Write-Host '== 4. Comparar conteos de las 14 tablas =='
  $columnas = ($tablas | ForEach-Object { "(SELECT count(*) FROM $_) AS $_" }) -join ', '
  $sqlConteo = "SELECT $columnas;"
  $conteoOrigen = (Invoke-Psql $origen $sqlConteo).Trim()
  $conteoRestaurado = (Invoke-Psql $destino $sqlConteo).Trim()

  Write-Host "Base original   : $conteoOrigen"
  Write-Host "Base restaurada : $conteoRestaurado"

  if ($conteoOrigen -eq $conteoRestaurado) {
    Write-Host 'RESULTADO: PASS - el restore reprodujo los datos exactamente'
    $codigo = 0
  } else {
    Write-Host 'RESULTADO: FAIL - los conteos no coinciden'
    $codigo = 1
  }
} catch {
  Write-Host "RESULTADO: FAIL - $($_.Exception.Message)"
  $codigo = 1
} finally {
  Write-Host '== 5. Limpieza =='
  Invoke-Psql 'postgres' "DROP DATABASE IF EXISTS $destino;" $true
  docker compose exec -T postgres sh -c "rm -f $archivo" 2>&1 | Out-Null
}

exit $codigo
