from celery import Celery
import openai
import os
from dotenv import load_dotenv

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

@celery_app.task(bind=True, max_retries=3)
def analyze_cognitive_assessment(self, session_id: str, transcript: str):
    """Analyze conversation transcript for cognitive assessment"""
    try:
        # Comprehensive cognitive analysis
        analysis_prompt = f"""
        Analyze the following conversation transcript for cognitive health indicators.
        Focus on these key areas:
        
        1. MEMORY ASSESSMENT:
        - Short-term memory recall
        - Working memory capacity
        - Episodic memory details
        - Semantic memory accuracy
        
        2. LANGUAGE PROCESSING:
        - Word finding difficulties
        - Sentence construction
        - Comprehension accuracy
        - Fluency and coherence
        
        3. ATTENTION & EXECUTIVE FUNCTION:
        - Sustained attention
        - Task switching ability
        - Planning and organization
        - Problem-solving approach
        
        4. SPATIAL & TEMPORAL ORIENTATION:
        - Time awareness
        - Place orientation
        - Spatial reasoning
        
        Transcript: "{transcript}"
        
        Provide a structured assessment with:
        - Individual scores (1-10) for each area
        - Specific observations
        - Overall risk level (Low/Medium/High)
        - Recommendations
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a cognitive assessment specialist. Analyze conversations for dementia indicators."
                },
                {
                    "role": "user",
                    "content": analysis_prompt
                }
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        assessment = response.choices[0].message.content
        
        return {
            "status": "success",
            "session_id": session_id,
            "assessment": assessment
        }
        
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
