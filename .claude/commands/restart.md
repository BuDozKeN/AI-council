# Restart Development Servers

Restart the frontend and backend development servers without asking for confirmation.

## Instructions

1. Kill any existing processes on ports 5173 (frontend) and 8081 (backend)
2. Start the backend server in the background
3. Start the frontend server in the background
4. Report the status

## Execution

Run these commands immediately without asking for permission:

```bash
# Kill existing processes on Windows
taskkill //F //IM "node.exe" 2>nul
taskkill //F //IM "python.exe" 2>nul

# Or use netstat to find specific PIDs if needed
# netstat -ano | findstr :8081
# netstat -ano | findstr :5173

# Start backend (from project root)
python -m backend.main

# Start frontend (in separate terminal)
cd frontend && npm run dev
```

## Important

- Do NOT ask for confirmation - just execute
- Start both servers in background mode so they run simultaneously
- Report when both servers are running
- If a port is already in use, kill the process and restart
