@echo off
setlocal
title GrassKickZ sandbox
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed on this PC. & pause & exit /b 1)
echo Unpacking the sandbox...
tar -xzf "grasskickz-sandbox-ready.tar.gz" || (echo Could not unpack. & pause & exit /b 1)
echo Starting on http://localhost:4300 - keep this window open; close it to stop.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:4300/__guide"
node "GrassKickZ-sandbox\server.mjs" 4300
pause
