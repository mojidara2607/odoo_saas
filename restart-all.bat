@echo off
REM ============================================================
REM RESTART ALL CONTAINERS
REM ============================================================
REM This script stops and then starts all containers.
REM Useful when things are acting weird.
REM ============================================================

echo ============================================================
echo   Restarting Odoo Multi-Tenant SaaS Demo...
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Stopping all containers...
docker compose down

echo.
echo [2/3] Starting all containers...
docker compose up -d

echo.
echo [3/3] Waiting for services to initialize (30 seconds)...
timeout /t 30 /nobreak > nul

echo.
echo ============================================================
echo   All services restarted successfully!
echo ============================================================
echo.
echo   Prajantha: http://localhost:8070
echo   Farmer:    http://localhost:8071
echo.
pause
