@echo off
REM ── ChroniNotes Setup Script (Windows) ──
REM Installs all dependencies and verifies prerequisites

echo.
echo ========================================
echo    ChroniNotes Setup
echo ========================================
echo.

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found!
    echo Install it from https://nodejs.org/
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js %%i

REM Check for npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm not found!
    echo It should come with Node.js. Try reinstalling Node.
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo [OK] npm %%i

REM Check for Rust
where rustc >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Rust not found!
    echo Install it from https://rustup.rs/
    exit /b 1
)
for /f "tokens=*" %%i in ('rustc --version') do echo [OK] %%i

REM Check for Cargo
where cargo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Cargo not found!
    echo Install Rust via https://rustup.rs/
    exit /b 1
)
for /f "tokens=*" %%i in ('cargo --version') do echo [OK] %%i

echo.
echo ── Installing root dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Root npm install failed!
    exit /b 1
)

echo.
echo ── Installing frontend dependencies...
cd frontend
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend npm install failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo ========================================
echo    Setup complete!
echo ========================================
echo.
echo Run the app:
echo   npm run dev           (standard)
echo   run-tauri-dev.bat     (if you get MSVC linker errors)
echo.
echo Build for production:
echo   npm run build
echo   run-tauri-build.bat   (if you get MSVC linker errors)
echo.
