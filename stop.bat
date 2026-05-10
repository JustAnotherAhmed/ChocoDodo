@echo off
REM Stop any ChocoDoDo server running on port 4242
title ChocoDoDo Stop

echo.
echo  Looking for ChocoDoDo server on port 4242...
echo.

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4242 .*LISTENING"') do (
    echo  Stopping PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
    set "FOUND=1"
)

if "%FOUND%"=="0" (
    echo  No server was running on port 4242.
) else (
    echo.
    echo  Server stopped.
)

echo.
timeout /t 2 /nobreak >nul
