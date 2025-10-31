@echo off
REM ==========================================================
REM EPICONSULT e-CLINIC — User Setup Helper Script
REM ==========================================================
echo.
echo ========================================
echo e-CLINIC User Management
echo ========================================
echo.

cd /d "%~dp0"

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run user management script
python manage_users.py %*

pause


