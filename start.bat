@echo off
title LinkedIn Poster
echo ============================================
echo        LinkedIn Poster - Starting...
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

:: Generate Prisma client
echo Generating Prisma client...
call npx prisma generate
call npx prisma db push
echo.

:: Build the app
echo Building the application...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)
echo.

:: Open browser after a short delay
echo Opening browser...
start "" http://localhost:3000

:: Start the production server
echo.
echo ============================================
echo   LinkedIn Poster is running at:
echo   http://localhost:3000
echo.
echo   Press Ctrl+C to stop the server.
echo ============================================
echo.
call npm run start
