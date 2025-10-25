from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
import asyncio
from typing import List
import os
from dotenv import load_dotenv

from .routers import auth, assessment, report
from .services.websocket_manager import ConnectionManager
from .services.redis_client import redis_client
from .services.celery_app import celery_app

load_dotenv()

app = FastAPI(
    title="Dementia Detection AI API",
    description="Conversational AI for Early Dementia Detection",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(assessment.router, prefix="/api/assessment", tags=["assessment"])
app.include_router(report.router, prefix="/api/report", tags=["report"])

# WebSocket connection manager
manager = ConnectionManager()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Receive audio data from frontend
            data = await websocket.receive_bytes()
            
            # Process audio through Redis job queue
            task = celery_app.send_task(
                'process_audio',
                args=[session_id, data.tobytes()],
                queue='speech_to_text'
            )
            
            # Send task ID back to frontend
            await websocket.send_text(json.dumps({
                "type": "task_started",
                "task_id": task.id
            }))
            
    except WebSocketDisconnect:
        manager.disconnect(session_id)

@app.get("/")
async def root():
    return {"message": "Dementia Detection AI API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "redis": await redis_client.ping()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
