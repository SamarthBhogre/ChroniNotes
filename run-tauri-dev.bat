@echo off
REM ── ChroniNotes Tauri Dev ──
REM Sets up MSVC environment and runs Tauri dev mode

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>&1
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "D:\College\Semester - 6\ChorniNotes"
npx tauri dev
