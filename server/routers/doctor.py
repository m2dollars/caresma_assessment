"""
Doctor Avatar API Router
Endpoints for AI doctor conversation and elderly care features
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime

router = APIRouter()

# In-memory session storage (in production, use Redis or database)
sessions = {}

class DoctorConversationRequest(BaseModel):
    session_id: str
    user_message: str
    conversation_history: Optional[List[Dict]] = []

class DoctorConversationResponse(BaseModel):
    session_id: str
    doctor_response: str
    timestamp: str

class SessionStartRequest(BaseModel):
    patient_name: Optional[str] = "Patient"
    patient_age: Optional[int] = None

class SessionStartResponse(BaseModel):
    session_id: str
    welcome_message: str
    status: str

@router.post("/start-session", response_model=SessionStartResponse)
async def start_doctor_session(request: SessionStartRequest):
    """
    Start a new doctor conversation session
    """
    session_id = f"doctor_session_{uuid.uuid4()}"
    
    # Create session
    sessions[session_id] = {
        "patient_name": request.patient_name,
        "patient_age": request.patient_age,
        "started_at": datetime.now().isoformat(),
        "conversation_history": [],
        "status": "active"
    }
    
    welcome_message = f"Hello! I'm Dr. Smith, your friendly AI doctor. It's wonderful to meet you today. How are you feeling?"
    
    return SessionStartResponse(
        session_id=session_id,
        welcome_message=welcome_message,
        status="active"
    )

@router.post("/conversation", response_model=DoctorConversationResponse)
async def doctor_conversation(request: DoctorConversationRequest):
    """
    Process a conversation turn with the AI doctor
    """
    try:
        # Get or create session
        if request.session_id not in sessions:
            sessions[request.session_id] = {
                "conversation_history": [],
                "started_at": datetime.now().isoformat(),
                "status": "active"
            }
        
        # Generate doctor response using Celery task
        from server.tasks.doctor_conversation import generate_doctor_response
        
        task = generate_doctor_response.delay(
            session_id=request.session_id,
            user_message=request.user_message,
            conversation_history=request.conversation_history
        )
        
        # Wait for result (in production, you might want to use webhooks or polling)
        result = task.get(timeout=30)
        
        if result["status"] == "success":
            doctor_response = result["response"]
            
            # Update session history
            sessions[request.session_id]["conversation_history"].extend([
                {"role": "user", "content": request.user_message},
                {"role": "assistant", "content": doctor_response}
            ])
            
            return DoctorConversationResponse(
                session_id=request.session_id,
                doctor_response=doctor_response,
                timestamp=datetime.now().isoformat()
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate response")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/session/{session_id}")
async def get_doctor_session(session_id: str):
    """
    Get doctor session details
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "session_data": sessions[session_id],
        "message_count": len(sessions[session_id].get("conversation_history", []))
    }

@router.post("/session/{session_id}/end")
async def end_doctor_session(session_id: str):
    """
    End a doctor session and generate final assessment
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    session["status"] = "completed"
    session["ended_at"] = datetime.now().isoformat()
    
    # Generate assessment if conversation history exists
    if session.get("conversation_history"):
        from server.tasks.doctor_conversation import analyze_elderly_conversation
        
        # Build transcript
        transcript = "\n".join([
            f"{'Patient' if msg['role'] == 'user' else 'Dr. Smith'}: {msg['content']}"
            for msg in session["conversation_history"]
        ])
        
        # Queue assessment task
        task = analyze_elderly_conversation.delay(
            session_id=session_id,
            full_transcript=transcript
        )
        
        return {
            "session_id": session_id,
            "status": "completed",
            "assessment_task_id": task.id,
            "message": "Session ended. Assessment is being generated."
        }
    
    return {
        "session_id": session_id,
        "status": "completed",
        "message": "Session ended."
    }

@router.get("/conversation-starters")
async def get_conversation_starters():
    """
    Get friendly conversation starter prompts for elderly patients
    """
    from server.tasks.doctor_conversation import (
        get_conversation_starter_prompts,
        get_memory_assessment_questions,
        get_orientation_assessment_questions
    )
    
    return {
        "starters": get_conversation_starter_prompts(),
        "memory_questions": get_memory_assessment_questions(),
        "orientation_questions": get_orientation_assessment_questions()
    }

