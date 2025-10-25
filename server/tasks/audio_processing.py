import asyncio
import base64
import io
from deepgram import DeepgramClient, PrerecordedOptions, FileSource
import openai
import elevenlabs
from server.services.websocket_manager import ConnectionManager
from server.services.celery_app import celery_app
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize clients
deepgram = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))
openai.api_key = os.getenv("OPENAI_API_KEY")
elevenlabs.set_api_key(os.getenv("ELEVENLABS_API_KEY"))

# WebSocket manager
manager = ConnectionManager()

@celery_app.task(bind=True, max_retries=3)
def process_audio(self, session_id: str, audio_data: bytes):
    """Process audio through speech-to-text, AI analysis, and text-to-speech"""
    try:
        # Step 1: Speech-to-Text with Deepgram
        audio_file = io.BytesIO(audio_data)
        payload: FileSource = {
            "buffer": audio_file,
        }
        
        options = PrerecordedOptions(
            model="nova-2",
            smart_format=True,
            punctuate=True,
            utterances=True
        )
        
        response = deepgram.listen.prerecorded.v("1").transcribe_file(
            payload, options
        )
        
        transcript = response.results.channels[0].alternatives[0].transcript
        
        # Step 2: Send transcript for AI processing
        process_ai_response.delay(session_id, transcript)
        
        return {"status": "success", "transcript": transcript}
        
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@celery_app.task(bind=True, max_retries=3)
def process_ai_response(self, session_id: str, transcript: str):
    """Process transcript through GPT-4 and generate response"""
    try:
        # GPT-4 conversation and cognitive assessment
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": """You are a compassionate AI assistant designed to help assess cognitive health in elderly users. 
                    Your role is to:
                    1. Engage in natural conversation
                    2. Subtly assess cognitive functions (memory, attention, language, executive function)
                    3. Be empathetic and supportive
                    4. Ask age-appropriate questions
                    5. Respond naturally and conversationally
                    
                    Current conversation context: This is a cognitive health assessment session."""
                },
                {
                    "role": "user",
                    "content": transcript
                }
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        # Send text response to frontend
        asyncio.create_task(manager.send_text_response(ai_response, session_id))
        
        # Step 3: Convert to speech
        generate_speech.delay(session_id, ai_response)
        
        return {"status": "success", "response": ai_response}
        
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@celery_app.task(bind=True, max_retries=3)
def generate_speech(self, session_id: str, text: str):
    """Convert text to speech using ElevenLabs"""
    try:
        # Generate speech using ElevenLabs
        audio = elevenlabs.generate(
            text=text,
            voice="Rachel",  # Warm, friendly voice
            model="eleven_monolingual_v1"
        )
        
        # Send audio to frontend
        asyncio.create_task(manager.send_audio_response(audio, session_id))
        
        return {"status": "success"}
        
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
