@echo off
rem Double-click: start the demo server and open the page. Closing this window stops it. Needs Node.js 18 or newer.
cd /d "%~dp0"
start "" /min cmd /c "timeout /t 2 & start http://127.0.0.1:8860/"
node serve.mjs
