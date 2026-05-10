@echo off
REM Creates a "ChocoDoDo Server" shortcut on the Desktop
title ChocoDoDo Shortcut Installer

set "SCRIPT_DIR=%~dp0"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ChocoDoDo Server.lnk"
set "TARGET=%SCRIPT_DIR%start.bat"
set "ICON=%SCRIPT_DIR%assets\images\logo.jpg"

echo.
echo  Creating Desktop shortcut...
echo.

powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Start the ChocoDoDo local server'; $s.IconLocation = '%ICON%'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo  Done. You can now double-click "ChocoDoDo Server" on your Desktop
    echo  to start the site instantly.
    echo.
    echo  Tip: drag it to the taskbar to pin it.
) else (
    echo  Sorry, shortcut creation failed. Run start.bat directly instead.
)

echo.
pause
