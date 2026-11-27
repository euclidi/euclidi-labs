@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (echo Python 3 launcher required; install Python or serve this folder over HTTPS. & pause & exit /b 1)
start "" http://localhost:8000/
py -3 -m http.server 8000
