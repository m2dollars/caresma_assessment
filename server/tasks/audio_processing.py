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
        
        # Step 2: Process AI response and wait for completion
        ai_task = process_ai_response.delay(session_id, transcript)
        ai_result = ai_task.get(timeout=30)
        
        return {
            "status": "success", 
            "transcript": transcript,
            "user_transcript": transcript,
            "response": ai_result.get("response", "")
        }
        
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@celery_app.task(bind=True, max_retries=3)
def process_ai_response(self, session_id: str, transcript: str):
    """Process transcript through GPT-4 and generate response using Dr. Smith personality"""
    try:
        # Import Doctor personality
        from server.tasks.doctor_conversation import DOCTOR_SYSTEM_PROMPT
        
        # GPT-4 conversation with Dr. Smith personality for elderly care
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": DOCTOR_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": transcript
                }
            ],
            max_tokens=150,  # Keep responses short for elderly patients
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        # Step 3: Convert to speech with elderly-friendly voice
        generate_speech.delay(session_id, ai_response)
        
        return {
            "status": "success", 
            "response": ai_response,
            "user_transcript": transcript
        }
        
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
