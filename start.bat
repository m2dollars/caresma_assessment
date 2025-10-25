@echo off
echo 🧠 Starting Dementia Detection AI System...

REM Check if Redis is running (simplified check)
echo ✅ Assuming Redis is running (please ensure Redis server is started)

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from template...
    copy env.example .env
    echo 📝 Please edit .env file with your API keys before continuing
    echo    Required: OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
    pause
    exit /b 1
)

echo ✅ Environment configuration found

REM Start backend services
echo 🚀 Starting FastAPI backend...
cd server
start "FastAPI Backend" cmd /k "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a moment
timeout /t 3 /nobreak > nul

echo 🚀 Starting Celery worker...
start "Celery Worker" cmd /k "celery -A server.services.celery_app worker --loglevel=info"

REM Wait a moment
timeout /t 3 /nobreak > nul

REM Start frontend
echo 🚀 Starting React frontend...
cd ..\client
start "React Frontend" cmd /k "npm start"

echo.
echo 🎉 Dementia Detection AI is starting up!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo.
echo Press any key to continue...
pause > nul
