param(
  [int]$Usuarios = 20,
  [int]$Iteraciones = 5,
  [string]$BaseUrl = 'http://localhost:3001/api'
)

$ErrorActionPreference = 'Stop'

$urls = @(
  "$BaseUrl/lineas",
  "$BaseUrl/micros",
  "$BaseUrl/tarifas",
  "$BaseUrl/micros/cercanos?lat=-17.8&lng=-63.2&radio=5"
)

$bloque = {
  param($listaUrls, $veces)
  $mediciones = @()
  foreach ($i in 1..$veces) {
    foreach ($url in $listaUrls) {
      $reloj = [System.Diagnostics.Stopwatch]::StartNew()
      $codigo = 0
      try {
        $respuesta = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        $codigo = [int]$respuesta.StatusCode
      } catch {
        if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode } else { $codigo = 0 }
      }
      $reloj.Stop()
      $mediciones += [pscustomobject]@{
        Ms = [math]::Round($reloj.Elapsed.TotalMilliseconds, 2)
        Code = $codigo
        Url = $url
      }
    }
  }
  return $mediciones
}

Write-Host "== Prueba de carga: $Usuarios usuarios x $Iteraciones iteraciones x 4 endpoints =="
Write-Host "Base: $BaseUrl"

$relojGeneral = [System.Diagnostics.Stopwatch]::StartNew()
$trabajos = @()
for ($u = 1; $u -le $Usuarios; $u++) {
  $trabajos += Start-Job -ScriptBlock $bloque -ArgumentList $urls, $Iteraciones
}

$mediciones = @()
foreach ($trabajo in $trabajos) {
  Wait-Job $trabajo | Out-Null
  $mediciones += Receive-Job $trabajo
  Remove-Job $trabajo
}
$relojGeneral.Stop()

$total = $mediciones.Count
if ($total -eq 0) { Write-Host 'RESULTADO: FAIL - no se obtuvieron mediciones'; exit 1 }

$fallos = @($mediciones | Where-Object { $_.Code -ne 200 }).Count
$ordenadas = @($mediciones | Sort-Object Ms)
$indiceP95 = [math]::Floor(0.95 * ($total - 1))
$promedio = [math]::Round(($mediciones | Measure-Object Ms -Average).Average, 2)
$p95 = [math]::Round($ordenadas[$indiceP95].Ms, 2)
$maximo = [math]::Round(($mediciones | Measure-Object Ms -Maximum).Maximum, 2)
$segundos = [math]::Round($relojGeneral.Elapsed.TotalSeconds, 2)
$porSegundo = [math]::Round($total / $relojGeneral.Elapsed.TotalSeconds, 1)

Write-Host ''
Write-Host "Peticiones totales : $total"
Write-Host "Respuestas 200     : $($total - $fallos)"
Write-Host "Errores            : $fallos"
Write-Host "Tiempo promedio    : $promedio ms"
Write-Host "Tiempo p95         : $p95 ms"
Write-Host "Tiempo maximo      : $maximo ms"
Write-Host "Duracion total     : $segundos s ($porSegundo peticiones/s)"
Write-Host ''

if ($fallos -eq 0 -and $p95 -le 3000) {
  Write-Host 'RESULTADO: PASS - p95 <= 3000 ms y sin errores (RNF-03)'
  exit 0
} else {
  Write-Host 'RESULTADO: FAIL - hay errores o el p95 supera 3000 ms (RNF-03)'
  exit 1
}
