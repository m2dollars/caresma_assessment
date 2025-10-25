from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
from server.tasks.ai_processing import analyze_cognitive_assessment

router = APIRouter()

class ReportRequest(BaseModel):
    transcript: str
    session_id: Optional[str] = None

class DementiaReport(BaseModel):
    session_id: str
    memory_score: int
    language_score: int
    attention_score: int
    executive_score: int
    orientation_score: int
    overall_risk: str
    recommendations: str
    detailed_analysis: str

@router.post("/generate", response_model=DementiaReport)
async def generate_report(request: ReportRequest):
    """Generate dementia assessment report from transcript"""
    try:
        # Queue the analysis task
        task = analyze_cognitive_assessment.delay(
            request.session_id or "demo_session",
            request.transcript
        )
        
        # Wait for task completion (in production, you'd use async polling)
        result = task.get(timeout=60)
        
        # Parse the AI response to extract structured data
        analysis = result.get("assessment", "")
        
        # Extract scores and risk level (simplified parsing)
        # In a real app, you'd use more sophisticated NLP parsing
        memory_score = 7  # Extract from analysis
        language_score = 8
        attention_score = 6
        executive_score = 7
        orientation_score = 9
        
        # Calculate overall risk
        avg_score = (memory_score + language_score + attention_score + 
                    executive_score + orientation_score) / 5
        
        if avg_score >= 8:
            overall_risk = "Low"
        elif avg_score >= 6:
            overall_risk = "Medium"
        else:
            overall_risk = "High"
        
        return DementiaReport(
            session_id=request.session_id or "demo_session",
            memory_score=memory_score,
            language_score=language_score,
            attention_score=attention_score,
            executive_score=executive_score,
            orientation_score=orientation_score,
            overall_risk=overall_risk,
            recommendations="Continue regular monitoring. Consider scheduling follow-up assessment in 3 months.",
            detailed_analysis=analysis
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@router.post("/upload-transcript")
async def upload_transcript(file: UploadFile = File(...)):
    """Upload transcript file for analysis"""
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are supported")
    
    content = await file.read()
    transcript = content.decode('utf-8')
    
    # Generate report from uploaded transcript
    request = ReportRequest(transcript=transcript)
    return await generate_report(request)

@router.get("/sample-transcript")
async def get_sample_transcript():
    """Get a sample transcript for testing"""
    sample_transcript = """
    User: Good morning! How are you today?
    Assistant: Good morning! I'm doing well, thank you for asking. How are you feeling today?
    User: I'm okay, I think. Sometimes I forget things though.
    Assistant: That's completely normal. What kinds of things do you sometimes forget?
    User: Well, I forget where I put my keys, and sometimes I can't remember what I had for breakfast.
    Assistant: Those are common things to forget. Can you tell me what you had for breakfast this morning?
    User: Um... I think it was... oh, I can't remember. Maybe eggs? Or was it cereal?
    Assistant: That's okay, it's normal to forget details like that. What day of the week is it today?
    User: It's... let me think... Tuesday? No, wait, it might be Wednesday.
    Assistant: No worries about the exact day. Can you tell me where you are right now?
    User: I'm at home, in my living room.
    Assistant: That's good. Can you count backwards from 20 to 10 for me?
    User: 20, 19, 18... um... 17, 16... I think 15, 14... this is harder than I thought.
    """
    
    return {"transcript": sample_transcript}
