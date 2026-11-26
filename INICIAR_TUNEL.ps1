# INICIAR_TUNEL.ps1
# Uso: abrir PowerShell en esta carpeta y ejecutar:
#   powershell -ExecutionPolicy Bypass -File .\INICIAR_TUNEL.ps1
# Deja esta ventana abierta mientras dure la demostracion.

$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'

if (-not (Test-Path $cloudflared)) {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) {
        $cloudflared = $cmd.Source
    } else {
        Write-Host "Cloudflared no encontrado. Instalando con winget..." -ForegroundColor Yellow
        winget install --id Cloudflare.cloudflared --exact --accept-package-agreements --accept-source-agreements
        $cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
        if (-not (Test-Path $cloudflared)) {
            Write-Error "No se encontro cloudflared.exe. Reinstala e intenta de nuevo."
            exit 1
        }
    }
}

Write-Host "Cloudflared: $cloudflared" -ForegroundColor Green

try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/lineas' -UseBasicParsing -TimeoutSec 8
    Write-Host "API local OK: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "La API local no responde. Arranca primero el backend: cd backend; npm run start" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Levantando tunel. Copia la URL https://....trycloudflare.com que aparece abajo." -ForegroundColor Cyan
Write-Host "NO CIERRES ESTA VENTANA. Si la cierras, la URL muere y cambiara al reiniciar." -ForegroundColor Yellow
Write-Host ""

& $cloudflared tunnel --url http://localhost:3001
