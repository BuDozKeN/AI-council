#!/bin/bash

# LLM Council - Start script

echo "Starting LLM Council..."
echo ""

# Start backend on port 8001
echo "Starting backend on http://localhost:8001..."
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend (will use http://localhost:5173)
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ LLM Council is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8001"
echo "  API Docs: http://localhost:8001/docs"
echo ""
echo "NOTE: Frontend expects API at http://localhost:8080 by default."
echo "      Set VITE_API_URL=http://localhost:8001 in frontend/.env.local to fix this."
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
