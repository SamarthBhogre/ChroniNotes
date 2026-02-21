@echo off
setlocal

set "PROJECT_DIR=D:\College\Semester - 6\ChorniNotes"
cd /d "%PROJECT_DIR%"

if not exist node_modules (
  echo Root dependencies not found. Running initial setup...
  call npm run setup
  if errorlevel 1 (
    echo Setup failed. Fix errors above and run this script again.
    exit /b 1
  )
)

echo Starting ChroniNotes development app...
call npm run dev
exit /b %ERRORLEVEL%
