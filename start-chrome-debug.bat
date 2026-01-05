@echo off
REM Launch Chrome with remote debugging enabled for MCP DevTools integration
REM This allows Claude to read console logs, network requests, and more

echo Starting Chrome with remote debugging on port 9222...
echo.
echo After Chrome opens, navigate to your app (e.g., http://localhost:5173)
echo Claude will then be able to see console errors and network issues.
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.axcouncil-chrome-debug" --no-first-run http://localhost:5173

echo Chrome launched! You can close this window.
