@echo off
setlocal enabledelayedexpansion
title WorkNow — Dev Environment

echo.
echo ============================================================
echo   WorkNow — Development Environment Startup
echo ============================================================
echo.

:: ── 1. Check Java ────────────────────────────────────────────
echo [1/6] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Java not found in PATH.
    echo.
    echo   Fix: Add Java to PATH manually:
    echo   1. Open "System Properties" ^> "Environment Variables"
    echo   2. Under "System variables", find "Path" and click Edit
    echo   3. Add your Java bin folder, e.g.:
    echo      C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot\bin
    echo   4. Click OK, then CLOSE and REOPEN this terminal
    echo.
    echo   Or install Java 21 from: https://adoptium.net
    echo.
    pause
    exit /b 1
)
for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set JAVA_VER=%%g
)
echo [OK] Java found: !JAVA_VER!

:: ── 2. Check Node.js ─────────────────────────────────────────
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node 20 LTS from https://nodejs.org
    pause
    exit /b 1
)
for /f %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js: !NODE_VER!

:: Warn if Node 24 (known compatibility issues with some Expo tools)
echo !NODE_VER! | findstr /b "v24" >nul
if not errorlevel 1 (
    echo.
    echo [WARNING] Node 24 detected. Expo works best with Node 20 LTS.
    echo           If you see Expo errors, switch to Node 20 using nvm:
    echo             nvm install 20 ^&^& nvm use 20
    echo.
)

:: ── 3. Check pnpm ────────────────────────────────────────────
echo [3/6] Checking pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] pnpm not found.
    echo.
    echo   Fix: Install pnpm globally:
    echo     npm install -g pnpm@9
    echo.
    echo   Then CLOSE and REOPEN this terminal.
    echo.
    pause
    exit /b 1
)
for /f %%v in ('pnpm --version') do set PNPM_VER=%%v
echo [OK] pnpm: !PNPM_VER!

:: ── 4. Check Firebase CLI ─────────────────────────────────────
echo [4/6] Checking Firebase CLI...
firebase --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] Firebase CLI not found. Installing globally...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo [ERROR] Failed to install Firebase CLI.
        pause
        exit /b 1
    )
)
for /f %%v in ('firebase --version') do set FB_VER=%%v
echo [OK] Firebase CLI: !FB_VER!

:: ── 5. Install dependencies ───────────────────────────────────
echo [5/6] Installing dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
    echo [ERROR] pnpm install failed. Try: pnpm install --no-frozen-lockfile
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: ── 6. Build shared packages + functions ─────────────────────
echo [6/6] Building packages and Cloud Functions...
call pnpm turbo build --filter=@workfix/types --filter=@workfix/utils --filter=@workfix/config
if errorlevel 1 (
    echo [ERROR] Shared package build failed.
    pause
    exit /b 1
)
cd functions
call pnpm build
if errorlevel 1 (
    echo [ERROR] Functions build failed. Check TypeScript errors above.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] All packages built.

:: ── Start ─────────────────────────────────────────────────────
echo.
echo ============================================================
echo   All checks passed! Starting services...
echo ============================================================
echo.
echo   Choose what to start:
echo   [1] Firebase Emulators + Expo (recommended)
echo   [2] Firebase Emulators only
echo   [3] Expo only (uses production Firebase)
echo   [4] Expo with --lan (use your local IP for phone)
echo   [5] Exit
echo.
set /p CHOICE="Enter choice [1]: "
if "!CHOICE!"=="" set CHOICE=1

if "!CHOICE!"=="1" goto :START_ALL
if "!CHOICE!"=="2" goto :START_EMULATORS
if "!CHOICE!"=="3" goto :START_EXPO
if "!CHOICE!"=="4" goto :START_EXPO_LAN
if "!CHOICE!"=="5" goto :END
goto :START_ALL

:START_ALL
echo.
echo Starting Firebase Emulators in a new window...
start "Firebase Emulators" cmd /k "firebase emulators:start --import=./emulator-data --export-on-exit"
echo Waiting 5 seconds for emulators to initialize...
timeout /t 5 /nobreak >nul
echo Starting Expo Metro bundler...
cd apps\mobile
set EXPO_PUBLIC_USE_EMULATOR=true
call pnpm start --clear
cd ..\..
goto :END

:START_EMULATORS
echo Starting Firebase Emulators...
firebase emulators:start --import=./emulator-data --export-on-exit
goto :END

:START_EXPO
echo Starting Expo (production Firebase)...
cd apps\mobile
call pnpm start --clear
cd ..\..
goto :END

:START_EXPO_LAN
echo Starting Expo with LAN mode...
echo Your local IP will be shown — use it on your phone.
cd apps\mobile
set EXPO_PUBLIC_USE_EMULATOR=false
call pnpm start --lan --clear
cd ..\..
goto :END

:END
endlocal
