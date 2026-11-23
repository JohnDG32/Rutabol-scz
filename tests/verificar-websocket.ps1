$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envLines = Get-Content (Join-Path $root 'backend\.env')
$demoLine = $envLines | Where-Object { $_ -like 'RUTABOL_DEMO_PASSWORD=*' }
if ($demoLine) { $env:RUTABOL_DEMO_PASSWORD = $demoLine -replace '^RUTABOL_DEMO_PASSWORD=','' }

# --use-system-ca permite validar el certificado local generado por mkcert.
$node = (Get-Command node).Source
$script = Join-Path $PSScriptRoot 'verificar-websocket.js'

Write-Host '== WebSocket en tiempo real (https://www.rutabol.test) =='
& $node --use-system-ca $script
if ($LASTEXITCODE -eq 0) { exit 0 }

# Node sin la opcion anterior: se usa el CA del sistema por variable de entorno.
Write-Host 'Reintentando con CA del sistema por variable de entorno...'
$env:NODE_EXTRA_CA_CERTS = Join-Path $env:LOCALAPPDATA 'mkcert\caroot.crt'
& $node $script
exit $LASTEXITCODE
