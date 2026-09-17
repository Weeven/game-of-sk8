@echo off
setlocal
cd /d "%~dp0"
start "KeeSK8 server" /b node scripts\sk8-server.mjs
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:420/sk8
