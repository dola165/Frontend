# Build and serve GrassKickZ frontend for the Cloudflare Tunnel.
# Usage: .\start-frontend.ps1 (double-click or run from any folder)
Set-Location $PSScriptRoot

Write-Host "Building frontend with current .env ..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build failed"
    exit $LASTEXITCODE
}

Write-Host "Serving dist on http://localhost:5173 ..." -ForegroundColor Green
npx --yes serve -s dist -l 5173
