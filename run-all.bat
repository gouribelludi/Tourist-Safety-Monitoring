@echo off
REM Launch Tourist Safety backend and main app server, then open dashboards
start cmd /k "cd /d "%~dp0tourist-safety\backend" && npm start"
start cmd /k "cd /d "%~dp0" && node server.js"
start "" http://localhost:3000/dashboard.html
start "" http://localhost:3000/tourist-safety/
