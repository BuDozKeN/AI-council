@echo off
REM AxCouncil Development Environment - One-click startup
REM Launches: Chrome (debug mode), Backend, Frontend

echo ========================================
echo   AxCouncil Dev Environment Starting
echo ========================================
echo.

REM Kill any stale processes on our ports
echo Cleaning up stale processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9222 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

REM Start Chrome with remote debugging (persistent profile so login is remembered)
echo Starting Chrome with DevTools debugging...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.axcouncil-chrome-debug" --no-first-run http://localhost:5173

REM Start Backend
echo Starting Backend on port 8081...
start "AxCouncil Backend" cmd /k "cd /d %~dp0 && python -m backend.main"

REM Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

REM Start Frontend
echo Starting Frontend on port 5173...
start "AxCouncil Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   All services starting!
echo ========================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8081
echo   Chrome:    Debug port 9222
echo.
echo   Claude can now see your browser console!
echo ========================================
