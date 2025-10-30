from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
import asyncio
from typing import List
import os
from dotenv import load_dotenv

from .routers import auth, assessment, report, doctor
from .services.websocket_manager import ConnectionManager
from .tasks.doctor_conversation import DOCTOR_SYSTEM_PROMPT
from .tasks.dementia_assessment_flow import (
    ACTIVE_ASSESSMENT_PROMPT, 
    get_next_question, 
    build_assessment_context,
    should_advance_stage
)
from .services.heygen_avatar import create_heygen_session, send_heygen_message
from openai import AzureOpenAI
from deepgram import DeepgramClient, PrerecordedOptions
from elevenlabs import generate, set_api_key, Voice, VoiceSettings
import base64

load_dotenv()

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPEN_AI_ENDPOINT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPEN_AI_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4")
AZURE_API_VERSION = os.getenv("AZURE_API_VERSION", "2024-02-15-preview")

# Initialize Azure OpenAI client
openai_client = None
if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY:
    openai_client = AzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_KEY,
        api_version=AZURE_API_VERSION
    )

DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY")
HEYGEN_KEY = os.getenv("HEYGEN_API_KEY") or os.getenv("HEYGEN_REALTIME_AVATAR_API_KEY")

# Initialize ElevenLabs API key
if ELEVENLABS_KEY:
    set_api_key(ELEVENLABS_KEY)

# Store conversation history, assessment stage, and HeyGen sessions per session
conversation_history = {}
assessment_stage = {}
heygen_sessions = {}  # Store HeyGen session IDs

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
app.include_router(doctor.router, prefix="/api/doctor", tags=["doctor"])

# WebSocket connection manager
manager = ConnectionManager()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    
    # Initialize session conversation history and assessment stage
    if session_id not in conversation_history:
        conversation_history[session_id] = []
        assessment_stage[session_id] = 0
    
    try:
        while True:
            # Receive message from frontend (can be text or binary)
            message = await websocket.receive()
            
            # Handle binary messages (audio data)
            if "bytes" in message:
                audio_data = message["bytes"]
                
                # Send acknowledgment
                await websocket.send_text(json.dumps({
                    "type": "processing",
                    "message": "Transcribing your speech..."
                }))
                
                try:
                    # Step 1: Transcribe audio using Deepgram
                    if DEEPGRAM_KEY and len(audio_data) > 1000:  # Check if audio has content
                        try:
                            deepgram = DeepgramClient(DEEPGRAM_KEY)
                            
                            payload = {"buffer": audio_data}
                            options = PrerecordedOptions(
                                model="nova-2",
                                smart_format=True,
                                punctuate=True
                            )
                            
                            response = deepgram.listen.prerecorded.v("1").transcribe_file(
                                payload, options
                            )
                            
                            user_transcript = response.results.channels[0].alternatives[0].transcript
                            
                            if not user_transcript or user_transcript.strip() == "":
                                user_transcript = "[No speech detected in audio]"
                        except Exception as e:
                            user_transcript = f"[Speech recognition error: {str(e)}]"
                    else:
                        user_transcript = "[Audio too short or Deepgram API key not configured]"
                    
                    # Send user transcript
                    await websocket.send_text(json.dumps({
                        "type": "user_transcript",
                        "text": user_transcript
                    }))
                    
                    # Step 2: Generate AI response using OpenAI GPT-4 with structured assessment
                    if openai_client and not user_transcript.startswith("["):
                        try:
                            # Add user's response to conversation history
                            conversation_history[session_id].append({
                                "role": "user",
                                "content": user_transcript
                            })
                            
                            # Get current assessment stage
                            current_stage = assessment_stage.get(session_id, 0)
                            next_question_info = get_next_question(current_stage)
                            
                            # Build assessment context with conversation history
                            messages = build_assessment_context(
                                conversation_history[session_id],
                                current_stage
                            )
                            
                            # Generate Dr. Smith's response using Azure OpenAI
                            response = openai_client.chat.completions.create(
                                model=AZURE_OPENAI_DEPLOYMENT,
                                messages=messages,
                                max_tokens=200,
                                temperature=0.7
                            )
                            
                            ai_response = response.choices[0].message.content
                            
                            # Store Dr. Smith's response in history
                            conversation_history[session_id].append({
                                "role": "assistant",
                                "content": ai_response
                            })
                            
                            # Advance to next assessment stage if appropriate
                            if should_advance_stage(user_transcript, current_stage):
                                assessment_stage[session_id] = current_stage + 1
                                
                                # Check if assessment is complete (reached stage 11 after stage 10)
                                if assessment_stage[session_id] >= 11:
                                    print(f"🏥 Assessment complete! Generating diagnosis...")
                                    
                                    # Notify client that assessment is complete
                                    await websocket.send_text(json.dumps({
                                        "type": "assessment_complete",
                                        "message": "Assessment complete. Dr. Smith is now analyzing your responses..."
                                    }))
                                    
                                    # Analyze the entire conversation for dementia diagnosis
                                    diagnosis_prompt = """Based on the entire conversation above, provide a brief dementia risk assessment as Dr. Smith speaking directly to the patient.

Analyze their performance across:
- Orientation (time, date awareness)
- Memory (recent events, immediate and delayed recall)
- Attention and calculation
- Language and verbal fluency
- Reasoning and judgment

Provide a compassionate but clear assessment in this format:

"Thank you for completing this assessment with me. Based on our conversation today, I observed [KEY FINDINGS - mention specific issues like memory problems, disorientation, difficulty with recall, etc.].

Your cognitive status appears to be [NORMAL / MILD COGNITIVE IMPAIRMENT / MODERATE COGNITIVE DECLINE / SIGNIFICANT COGNITIVE CONCERNS].

[If concerning signs detected]: I'm concerned about some signs that suggest possible dementia or significant cognitive decline. I strongly recommend that you visit a hospital or neurologist as soon as possible for a comprehensive evaluation and brain imaging.

[If mild concerns]: I recommend scheduling a follow-up appointment with your doctor within the next 1-3 months to monitor your cognitive health.

[If normal]: Your cognitive function appears to be within normal range. Continue with regular health check-ups and maintain a healthy lifestyle.

[End with]: Is there anything you'd like to ask me about these findings?"

Be direct, professional, and compassionate. If you detect signs of dementia, clearly state "you may have dementia" and urgently recommend hospital visit."""

                                    diagnosis_messages = conversation_history[session_id] + [
                                        {"role": "system", "content": diagnosis_prompt}
                                    ]
                                    
                                    try:
                                        diagnosis_response = client.chat.completions.create(
                                            model="gpt-4o",
                                            messages=diagnosis_messages,
                                            max_tokens=300,
                                            temperature=0.7
                                        )
                                        
                                        diagnosis_text = diagnosis_response.choices[0].message.content
                                        print(f"📋 Diagnosis generated: {diagnosis_text[:100]}...")
                                        
                                        # Override ai_response with diagnosis
                                        ai_response = diagnosis_text
                                        
                                        # Store diagnosis in history
                                        conversation_history[session_id].append({
                                            "role": "assistant",
                                            "content": diagnosis_text
                                        })
                                        
                                    except Exception as e:
                                        print(f"Error generating diagnosis: {str(e)}")
                                        ai_response = "Thank you for completing the assessment. Based on our conversation, I recommend scheduling a follow-up appointment with a healthcare professional to discuss your cognitive health in more detail."
                            
                        except Exception as e:
                            ai_response = f"I'm here to help! Let me try again. Could you please repeat that? (Error: {str(e)[:100]})"
                    else:
                        ai_response = "I'm Dr. Smith, your AI doctor. I'll be asking you some questions to understand your cognitive health better. Please make sure you speak clearly into your microphone."
                    
                    # Send AI text response
                    await websocket.send_text(json.dumps({
                        "type": "ai_response",
                        "text": ai_response
                    }))
                    
                    # Send message to HeyGen avatar if session exists
                    if HEYGEN_KEY and session_id in heygen_sessions:
                        try:
                            heygen_session_id = heygen_sessions[session_id]
                            print(f"Sending to HeyGen avatar: {ai_response[:50]}...")
                            
                            result = await send_heygen_message(
                                api_key=HEYGEN_KEY,
                                session_id=heygen_session_id,
                                text=ai_response
                            )
                            
                            if result.get("success"):
                                print(f"HeyGen avatar speaking...")
                            else:
                                print(f"HeyGen error: {result.get('error')}")
                                
                        except Exception as e:
                            print(f"HeyGen error: {str(e)}")
                    
                    # Also generate audio as fallback using ElevenLabs
                    if ELEVENLABS_KEY:
                        try:
                            # Use ElevenLabs TTS with default voice (doesn't require voices_read permission)
                            audio_stream = generate(
                                text=ai_response,
                                api_key=ELEVENLABS_KEY
                            )
                            
                            # Convert audio stream to base64
                            audio_base64 = base64.b64encode(audio_stream).decode('utf-8')
                            
                            # Send audio response
                            await websocket.send_text(json.dumps({
                                "type": "ai_audio",
                                "audio": audio_base64
                            }))
                        except Exception as e:
                            print(f"ElevenLabs TTS error: {str(e)}")
                            # Continue without audio if TTS fails
                    
                except Exception as e:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Error processing: {str(e)}"
                    }))
                
            # Handle text messages (JSON commands)
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    
                    # Handle different message types
                    if data.get("type") == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong"
                        }))
                    elif data.get("type") == "speak_text":
                        # Handle welcome message - start assessment
                        # Get first assessment question
                        first_question = get_next_question(0)
                        
                        # Initialize conversation with greeting
                        conversation_history[session_id] = [{
                            "role": "assistant",
                            "content": first_question["question"]
                        }]
                        assessment_stage[session_id] = 1  # Move to next stage after greeting
                        
                        # Send text response
                        await websocket.send_text(json.dumps({
                            "type": "ai_response",
                            "text": first_question["question"]
                        }))
                        
                        # Generate audio with ElevenLabs TTS
                        if ELEVENLABS_KEY:
                            print(f"Generating welcome message audio with ElevenLabs...")
                            try:
                                audio_stream = generate(
                                    text=first_question["question"],
                                    api_key=ELEVENLABS_KEY
                                )
                                
                                # Convert audio stream to base64
                                audio_base64 = base64.b64encode(audio_stream).decode('utf-8')
                                
                                # Send audio response
                                await websocket.send_text(json.dumps({
                                    "type": "ai_audio",
                                    "audio": audio_base64
                                }))
                                print(f"✅ Welcome message audio sent to client")
                            except Exception as e:
                                print(f"ElevenLabs TTS error: {str(e)}")
                        
                        # Send greeting to HeyGen avatar if session exists
                        if HEYGEN_KEY and session_id in heygen_sessions:
                            try:
                                heygen_session_id = heygen_sessions[session_id]
                                print(f"Sending greeting to HeyGen avatar...")
                                
                                result = await send_heygen_message(
                                    api_key=HEYGEN_KEY,
                                    session_id=heygen_session_id,
                                    text=first_question["question"]
                                )
                                
                                if result.get("success"):
                                    print(f"HeyGen avatar speaking greeting!")
                                else:
                                    print(f"HeyGen error: {result.get('error')}")
                                    
                            except Exception as e:
                                print(f"HeyGen error: {str(e)}")
                except json.JSONDecodeError:
                    pass
            
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except RuntimeError as e:
        # Handle "Cannot call receive once disconnect" error
        manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error for session {session_id}: {str(e)}")
        manager.disconnect(session_id)

@app.get("/")
async def root():
    return {"message": "Dementia Detection AI API is running"}

@app.get("/health")
async def health_check():
    services = {
        "status": "healthy",
        "azure_openai": bool(openai_client),
        "azure_endpoint": AZURE_OPENAI_ENDPOINT if openai_client else None,
        "deepgram": bool(DEEPGRAM_KEY),
        "elevenlabs": bool(ELEVENLABS_KEY),
        "heygen": bool(HEYGEN_KEY),
        "assessment_system": "active",
        "tts_enabled": bool(ELEVENLABS_KEY),
        "realtime_avatar_enabled": bool(HEYGEN_KEY)
    }
    return services

@app.post("/api/heygen/create-session")
async def create_heygen_avatar_session():
    """Create a new HeyGen streaming avatar session"""
    if not HEYGEN_KEY:
        print("WARNING: HeyGen API key not found in environment variables")
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    
    print(f"Creating HeyGen session with API key: {HEYGEN_KEY[:10]}...")
    
    try:
        result = await create_heygen_session(HEYGEN_KEY)
        print(f"HeyGen session result: {result}")
        
        if result.get("success"):
            return result
        else:
            error_msg = result.get("error", "Unknown error")
            print(f"HeyGen session creation failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"HeyGen error: {error_msg}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Exception creating HeyGen session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Exception: {str(e)}")

@app.post("/api/heygen/start-session")
async def start_heygen_session(session_data: dict):
    """Start a HeyGen session with SDP answer"""
    if not HEYGEN_KEY:
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    
    try:
        from .services.heygen_avatar import HeyGenStreamingAvatar
        client = HeyGenStreamingAvatar(HEYGEN_KEY)
        
        session_id = session_data.get("session_id")
        sdp_answer = session_data.get("sdp_answer")
        user_session_id = session_data.get("user_session_id")
        
        result = await client.start_streaming(session_id, sdp_answer)
        
        # Store the HeyGen session ID
        if result.get("success") and user_session_id:
            heygen_sessions[user_session_id] = session_id
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
