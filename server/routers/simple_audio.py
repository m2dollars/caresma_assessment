"""
Simple Audio Processing without Redis/Celery
Direct API calls for demo purposes
"""

import os
import io
from dotenv import load_dotenv
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

# Import AI services
try:
    from deepgram import DeepgramClient, PrerecordedOptions
    import openai
    from elevenlabs import generate, set_api_key
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

load_dotenv()

router = APIRouter()

# Initialize API clients
if SERVICES_AVAILABLE:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
    ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY")
    
    if ELEVENLABS_KEY:
        set_api_key(ELEVENLABS_KEY)

class AudioTranscriptRequest(BaseModel):
    audio_base64: str

@router.post("/process-audio-simple")
async def process_audio_simple(file: UploadFile = File(...)):
    """
    Process audio directly without Redis/Celery
    For demo purposes when Redis is not available
    """
    
    if not SERVICES_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI services not available. Please install: pip install deepgram-sdk openai elevenlabs"
        )
    
    try:
        # Read audio file
        audio_bytes = await file.read()
        
        # Step 1: Speech-to-Text with Deepgram
        if DEEPGRAM_KEY:
            try:
                deepgram = DeepgramClient(DEEPGRAM_KEY)
                
                payload = {"buffer": audio_bytes}
                options = PrerecordedOptions(
                    model="nova-2",
                    smart_format=True,
                    punctuate=True
                )
                
                response = deepgram.listen.prerecorded.v("1").transcribe_file(
                    payload, options
                )
                
                transcript = response.results.channels[0].alternatives[0].transcript
            except Exception as e:
                transcript = f"[Speech-to-text error: {str(e)}]"
        else:
            transcript = "[No Deepgram API key configured]"
        
        # Step 2: Generate AI response with GPT-4
        if openai.api_key and transcript:
            try:
                from server.tasks.doctor_conversation import DOCTOR_SYSTEM_PROMPT
                
                response = openai.ChatCompletion.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": DOCTOR_SYSTEM_PROMPT},
                        {"role": "user", "content": transcript}
                    ],
                    max_tokens=150,
                    temperature=0.7
                )
                
                ai_response = response.choices[0].message.content
            except Exception as e:
                ai_response = f"I apologize, but I encountered an error: {str(e)}"
        else:
            ai_response = "OpenAI API key not configured."
        
        # Step 3: Generate speech (optional, for future enhancement)
        # For now, just return text responses
        
        return {
            "status": "success",
            "transcript": transcript,
            "ai_response": ai_response
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-services")
async def check_services():
    """Check which AI services are available"""
    
    services = {
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "deepgram": bool(os.getenv("DEEPGRAM_API_KEY")),
        "elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY")),
        "services_installed": SERVICES_AVAILABLE
    }
    
    return services

