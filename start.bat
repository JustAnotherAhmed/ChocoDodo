@echo off
REM ============================================================
REM  ChocoDoDo — one-click start
REM  Double-click this file (or its desktop shortcut) to run
REM  the local site at http://localhost:4242
REM ============================================================

title ChocoDoDo Server
color 0E

cd /d "%~dp0backend"

REM First-time setup: install deps if node_modules missing
if not exist "node_modules" (
    echo.
    echo  ===========================================
    echo   First-time setup: installing dependencies
    echo   This takes about 30-60 seconds...
    echo  ===========================================
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  ERROR: npm install failed.
        echo  Make sure Node.js is installed: https://nodejs.org
        pause
        exit /b 1
    )
)

REM First-time setup: create .env from example if missing
if not exist ".env" (
    echo.
    echo   No .env found - creating from template...
    copy ".env.example" ".env" >nul
    echo   Edit backend\.env to set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
    echo.
    pause
)

REM Open the site in the default browser after a short delay
start "" /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:4242"

echo.
echo  ============================================
echo   ChocoDoDo is starting on
echo     http://localhost:4242
echo.
echo   Admin panel:
echo     http://localhost:4242/pages/admin.html
echo.
echo   Press Ctrl+C or close this window to stop.
echo  ============================================
echo.

call npm start
