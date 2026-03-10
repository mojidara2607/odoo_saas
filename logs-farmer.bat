@echo off
REM ============================================================
REM VIEW LOGS FOR FARMER
REM ============================================================
REM Shows live logs from Farmer's Odoo instance.
REM Press Ctrl+C to stop viewing logs.
REM ============================================================

echo ============================================================
echo   Showing logs for Farmer (Press Ctrl+C to stop)
echo ============================================================
echo.

cd /d "%~dp0"

docker compose logs -f odoo-farmer db-farmer
