@echo off
REM ============================================================
REM START ALL CONTAINERS
REM ============================================================
REM This script starts both Odoo instances and their databases.
REM It will download Docker images on first run (may take a few minutes).
REM ============================================================

echo ============================================================
echo   Starting Odoo Multi-Tenant SaaS Demo...
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting all Docker containers...
docker compose up -d

echo.
echo [2/2] Waiting for services to initialize (30 seconds)...
timeout /t 30 /nobreak > nul

echo.
echo ============================================================
echo   ALL SERVICES ARE RUNNING!
echo ============================================================
echo.
echo   Prajantha: http://localhost:8070
echo   Farmer:    http://localhost:8071
echo.
echo   Nginx (optional):
echo     http://prajatha.localhost
echo     http://farmer.localhost
echo.
echo ============================================================
echo   Press any key to close this window...
echo ============================================================
pause > nul
