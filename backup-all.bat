@echo off
REM ============================================================
REM BACKUP ALL DATABASES
REM ============================================================
REM Creates a SQL dump of each client's PostgreSQL database.
REM Backups are saved to the ./backups/ folder with timestamps.
REM ============================================================

echo ============================================================
echo   Backing up all client databases...
echo ============================================================
echo.

cd /d "%~dp0"

REM Create backups folder if it doesn't exist
if not exist "backups" mkdir backups

REM Get current date and time for filename
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set TIMESTAMP=%datetime:~0,8%-%datetime:~8,6%

echo Backup timestamp: %TIMESTAMP%
echo.

REM Backup each client's database
echo [1/2] Backing up Prajatha...
docker exec saas-db-prajatha pg_dumpall -U odoo_prajatha > "backups\prajatha_%TIMESTAMP%.sql" 2>nul
if %ERRORLEVEL% EQU 0 (echo       OK) else (echo       FAILED - is the container running?)

echo [2/2] Backing up Farmer...
docker exec saas-db-farmer pg_dumpall -U odoo_farmer > "backups\farmer_%TIMESTAMP%.sql" 2>nul
if %ERRORLEVEL% EQU 0 (echo       OK) else (echo       FAILED - is the container running?)

echo.
echo ============================================================
echo   Backups saved to: backups\
echo ============================================================
echo.
dir /b backups\*%TIMESTAMP%*
echo.
pause
