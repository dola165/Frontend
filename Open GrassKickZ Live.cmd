@echo off
rem Opens the live GrassKickZ redesign: real Vite with instant reload, on made-up data.
rem Leave the two server windows open while you look around. Closing them stops the app.
set "WT=C:\Users\daddo\Projects\Frontend-claude-sandbox"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5174/ | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 goto open
start "GrassKickZ data (keep open)" /D "%WT%" cmd /k node frontend\sandbox\server.mjs 4301
start "GrassKickZ app (keep open)" /D "%WT%" cmd /k node frontend\node_modules\vite\bin\vite.js --config frontend\vite.sandbox.config.ts
echo Starting GrassKickZ...
timeout /t 8 /nobreak >nul
:open
start "" http://localhost:5174/home
