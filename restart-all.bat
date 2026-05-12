@echo off
REM Restart both servers (backend 5000, main 3000)
call stop-all.bat
REM Launch backend (quote path because of space in directory name)
start cmd /k "cd /d "%~dp0tourist-safety\backend" && npm start"
REM Launch main server
start cmd /k "cd /d "%~dp0" && node server.js"
REM Open dashboards
start "" http://localhost:3000/dashboard.html
start "" http://localhost:3000/tourist-safety/
echo Restart sequence initiated. Waiting for servers...
timeout /t 4 /nobreak >NUL
echo Checking ports...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| find ":3000" ^| find "LISTENING"') do echo Port 3000 listening (PID %%a)
for /f "tokens=5" %%a in ('netstat -a -n -o ^| find ":5000" ^| find "LISTENING"') do echo Port 5000 listening (PID %%a)
echo Done.