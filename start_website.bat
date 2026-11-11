@echo off
REM Starts a local web server for the memristor website and opens it in the browser.
REM Only this folder is served, and only to this computer (127.0.0.1).
cd /d "%~dp0"
echo Serving %CD% at http://localhost:8000
echo Close this window (or press Ctrl+C) to stop the server.
start "" http://localhost:8000
python -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 py -m http.server 8000 --bind 127.0.0.1
pause
