# GrassKickZ sandbox launcher (Windows PowerShell 5.1+).
# Put this file, "Start GrassKickZ Sandbox.cmd" and grasskickz-overhaul-sandbox.bundle in your
# Frontend repository folder (for example C:\Users\daddo\WebstormProjects\Frontend) and double-click the .cmd.
# It imports the sandbox branch from the bundle into its own folder, installs packages the first time,
# builds, starts the sandbox and opens the test guide. Your other checkouts are not touched.
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$branch = 'claude/overhaul-sandbox'
$tracking = 'refs/remotes/claude/overhaul-sandbox'
$sandbox = Join-Path (Split-Path $repo -Parent) '..\Projects\Frontend-claude-sandbox'
if ($env:GK_SANDBOX_DIR) { $sandbox = $env:GK_SANDBOX_DIR }
$sandbox = [System.IO.Path]::GetFullPath($sandbox)
$port = 4300

function Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Green }
function Fail($text) { Write-Host ''; Write-Host $text -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

foreach ($tool in 'git', 'node', 'npm') { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool is not installed or not on PATH." } }

$bundle = Get-ChildItem -Path $repo -Filter 'grasskickz-overhaul-sandbox*.bundle' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $bundle) { Fail "No grasskickz-overhaul-sandbox.bundle found in $repo." }

Step "Importing $($bundle.Name)"
git -C $repo fetch $bundle.FullName "+${branch}:$tracking"
if ($LASTEXITCODE -ne 0) { Fail 'Could not read the bundle. Your repository needs the codex/football-experience-20261009 branch fetched.' }

if (-not (Test-Path (Join-Path $sandbox '.git'))) {
    Step "Creating the sandbox folder $sandbox"
    git -C $repo worktree add -B $branch $sandbox $tracking
    if ($LASTEXITCODE -ne 0) { Fail 'Could not create the sandbox folder.' }
} else {
    Step 'Updating the sandbox folder'
    $dirty = git -C $sandbox status --porcelain --untracked-files=no
    if ($dirty) {
        Write-Host 'The sandbox folder has local edits, so it was not updated. Starting it as it is.' -ForegroundColor Yellow
    } else {
        git -C $sandbox merge --ff-only $tracking
        if ($LASTEXITCODE -ne 0) { Write-Host 'Could not fast-forward; starting the existing version.' -ForegroundColor Yellow }
    }
}

$frontend = Join-Path $sandbox 'frontend'
Set-Location $frontend

$stamp = Join-Path $frontend 'node_modules\.gk-lock-hash'
$lockHash = (Get-FileHash (Join-Path $frontend 'package-lock.json')).Hash
if (-not (Test-Path $stamp) -or ((Get-Content $stamp -ErrorAction SilentlyContinue) -ne $lockHash)) {
    Step 'Installing packages (first run takes a few minutes)'
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed. Check your internet connection and try again.' }
    Set-Content -Path $stamp -Value $lockHash
}

Step 'Building'
node sandbox/build.mjs
if ($LASTEXITCODE -ne 0) { Fail 'The build failed. Send the messages above to Claude.' }

$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($busy) { Fail "Port $port is already in use (an older sandbox window may still be open). Close it and run this again." }

Step "Starting the sandbox on http://localhost:$port (close this window to stop it)"
$server = Start-Process -FilePath 'node' -ArgumentList 'sandbox/server.mjs', "$port" -NoNewWindow -PassThru
Start-Sleep -Seconds 2
Start-Process "http://localhost:$port/__guide"
Wait-Process -Id $server.Id
