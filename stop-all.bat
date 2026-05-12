@echo off
REM Stop processes listening on ports 3000 and 5000
setlocal enabledelayedexpansion
for /f "tokens=5" %%a in ('netstat -a -n -o ^| find ":3000" ^| find "LISTENING"') do (
  echo Killing PID %%a on port 3000
  taskkill /PID %%a /F >NUL 2>&1
)
for /f "tokens=5" %%a in ('netstat -a -n -o ^| find ":5000" ^| find "LISTENING"') do (
  echo Killing PID %%a on port 5000
  taskkill /PID %%a /F >NUL 2>&1
)
echo Done.
endlocal