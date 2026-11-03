@echo off
title CarbonLens Server
cd /d "%~dp0"
echo ==================================================================
echo   Starting CarbonLens: Smart Campus Sustainability Tracker
echo   Course: CS-2104 Database Systems
echo ==================================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else (
        echo [ERROR] Node.js is not found. Please ensure Node.js is installed.
        pause
        exit /b 1
    )
)

echo Starting Node.js server on port 3000...
start "" "http://localhost:3000"
node server.js
pause
