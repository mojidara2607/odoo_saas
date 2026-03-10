@echo off
REM ============================================================
REM VIEW LOGS FOR PRAJATHA
REM ============================================================
REM Shows live logs from Prajatha's Odoo instance.
REM Press Ctrl+C to stop viewing logs.
REM ============================================================

echo ============================================================
echo   Showing logs for Prajatha (Press Ctrl+C to stop)
echo ============================================================
echo.

cd /d "%~dp0"

docker compose logs -f odoo-prajatha
