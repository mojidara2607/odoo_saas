@echo off
REM ============================================================
REM STOP ALL CONTAINERS
REM ============================================================
REM This script stops all running containers.
REM Your data is PRESERVED - it will be there when you start again.
REM ============================================================

echo ============================================================
echo   Stopping Odoo Multi-Tenant SaaS Demo...
echo ============================================================
echo.

cd /d "%~dp0"

docker compose down

echo.
echo ============================================================
echo   All containers stopped successfully.
echo   Your data is saved and will persist on next start.
echo ============================================================
echo.
pause
