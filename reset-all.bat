@echo off
REM ============================================================
REM RESET EVERYTHING (DANGER!)
REM ============================================================
REM This script DELETES all containers AND all data.
REM After running this, you'll start completely fresh.
REM USE WITH CAUTION!
REM ============================================================

echo ============================================================
echo   WARNING: This will DELETE ALL DATA!
echo ============================================================
echo.
echo   This will:
echo     - Stop all containers
echo     - Remove all containers
echo     - DELETE all database data
echo     - DELETE all filestore data
echo     - You will need to set up everything from scratch
echo.
echo ============================================================

set /p CONFIRM=Are you SURE? Type YES to confirm:

if /i not "%CONFIRM%"=="YES" (
    echo.
    echo   Cancelled. Nothing was deleted.
    pause
    exit /b
)

echo.
echo [1/4] Stopping and removing all containers...
cd /d "%~dp0"
docker compose down -v

echo.
echo [2/4] Removing database data...
for %%i in (1 2) do (
    if exist "client%%i\data" rd /s /q "client%%i\data"
    mkdir "client%%i\data"
)

echo.
echo [3/4] Removing filestore data...
for %%i in (1 2) do (
    if exist "client%%i\odoo-data" rd /s /q "client%%i\odoo-data"
    mkdir "client%%i\odoo-data"
)

echo.
echo [4/4] Cleanup complete.

echo.
echo ============================================================
echo   Everything has been reset.
echo   Run start-all.bat to set up fresh instances.
echo ============================================================
echo.
pause
