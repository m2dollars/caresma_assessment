#!/bin/bash

# Dementia Detection AI - Startup Script

echo "🧠 Starting Dementia Detection AI System..."

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start Redis server first."
    echo "   Docker: docker run -d -p 6379:6379 redis:7-alpine"
    echo "   Or install Redis locally"
    exit 1
fi

echo "✅ Redis is running"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your API keys before continuing"
    echo "   Required: OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY"
    exit 1
fi

echo "✅ Environment configuration found"

# Start backend services
echo "🚀 Starting FastAPI backend..."
cd server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

echo "🚀 Starting Celery worker..."
celery -A server.services.celery_app worker --loglevel=info &
CELERY_PID=$!

# Wait a moment for Celery to start
sleep 3

# Start frontend
echo "🚀 Starting React frontend..."
cd ../client
npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 Dementia Detection AI is starting up!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID $CELERY_PID $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait

