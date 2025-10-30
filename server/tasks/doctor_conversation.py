"""
AI Doctor Conversation Processing
Specialized prompts and handling for elderly patient conversations
"""

import openai
import os
from dotenv import load_dotenv
from server.services.celery_app import celery_app
from typing import List, Dict

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

# Doctor personality and conversation context - Professional Virtual Interviewer
DOCTOR_SYSTEM_PROMPT = """
You are Dr. Smith, a warm yet professional virtual interviewer conducting cognitive health assessments for elderly individuals.

YOUR PROFESSIONAL ROLE:
- You are a virtual AI doctor conducting a structured cognitive interview
- Your goal is to assess cognitive function through systematic, caring conversation
- You are an expert in geriatric cognitive assessment and dementia detection
- You maintain professional boundaries while showing genuine warmth

INTERVIEWER STYLE:
- Speak clearly, professionally, and warmly - like a caring doctor during an examination
- Ask ONE focused question at a time, then listen carefully to the response
- Use active listening phrases: "I see," "Thank you for sharing that," "That's very helpful"
- Keep your responses concise (2-3 sentences maximum)
- Acknowledge their answers before moving to the next question
- Maintain a professional yet friendly demeanor throughout

STRUCTURED ASSESSMENT APPROACH:
- Systematically assess: orientation, memory, attention, language, and reasoning
- Ask questions in a logical progression
- Note their responses mentally and guide conversation forward
- Make assessments feel like natural conversation, not clinical tests
- Be encouraging when they answer correctly
- Be supportive and reassuring when they struggle

COMMUNICATION GUIDELINES:
- Use simple, clear language suitable for elderly people
- Avoid medical jargon and complex terminology
- Be respectful and dignified - never condescending
- Show patience and give them time to think
- Repeat or rephrase questions if needed
- Validate their feelings and show empathy

PROFESSIONAL BOUNDARIES:
- You are conducting an assessment, not diagnosing
- Focus on gathering information through conversation
- Never diagnose or prescribe
- If concerns arise, suggest consulting their regular healthcare provider
- Maintain focus on the systematic assessment

Remember: You are a professional virtual interviewer making elderly people feel comfortable while conducting an important cognitive health assessment. Balance warmth with professionalism.
"""

@celery_app.task(bind=True, max_retries=3)
def generate_doctor_response(self, session_id: str, user_message: str, conversation_history: List[Dict] = None):
    """
    Generate empathetic doctor response for elderly patients
    
    Args:
        session_id: Session identifier
        user_message: User's message text
        conversation_history: Previous conversation messages
    
    Returns:
        dict: Response text and metadata
    """
    try:
        # Build conversation history
        messages = [{"role": "system", "content": DOCTOR_SYSTEM_PROMPT}]
        
        # Add conversation history if available
        if conversation_history:
            for msg in conversation_history[-10:]:  # Last 10 messages for context
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Generate response
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
            max_tokens=150,  # Keep responses concise
            temperature=0.7,  # Warm and natural
            presence_penalty=0.6,  # Encourage diverse responses
            frequency_penalty=0.3
        )
        
        doctor_response = response.choices[0].message.content.strip()
        
        return {
            "status": "success",
            "session_id": session_id,
            "response": doctor_response,
            "metadata": {
                "tokens_used": response.usage.total_tokens,
                "model": "gpt-4"
            }
        }
        
    except openai.error.RateLimitError:
        # Handle rate limiting with retry
        raise self.retry(exc=Exception("Rate limit reached"), countdown=30)
    
    except Exception as exc:
        print(f"Error generating doctor response: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True)
def analyze_elderly_conversation(self, session_id: str, full_transcript: str):
    """
    Analyze conversation for cognitive health indicators in elderly patients
    
    Args:
        session_id: Session identifier
        full_transcript: Complete conversation transcript
    
    Returns:
        dict: Comprehensive cognitive assessment
    """
    try:
        analysis_prompt = f"""
        As Dr. Smith, analyze this conversation with an elderly patient for cognitive health indicators.
        
        Conversation Transcript:
        {full_transcript}
        
        Provide a compassionate assessment covering:
        
        1. MEMORY FUNCTION (Score 1-10):
        - Ability to recall recent events
        - Remembering conversation details
        - Personal history recall
        - Recognition of familiar information
        
        2. LANGUAGE & COMMUNICATION (Score 1-10):
        - Clarity of expression
        - Word-finding ability
        - Sentence structure
        - Understanding questions
        - Staying on topic
        
        3. ORIENTATION (Score 1-10):
        - Awareness of time (date, day, season)
        - Awareness of place
        - Awareness of situation
        
        4. REASONING & JUDGMENT (Score 1-10):
        - Problem-solving approach
        - Logical thinking
        - Decision-making ability
        
        5. ATTENTION & FOCUS (Score 1-10):
        - Ability to follow conversation
        - Sustained attention
        - Response appropriateness
        
        Overall Assessment:
        - Strengths observed
        - Areas of concern (if any)
        - Recommendations for family/caregivers
        - Suggested next steps
        
        IMPORTANT: Be respectful, compassionate, and focus on supporting the patient's dignity.
        If concerns are noted, frame them gently and constructively.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are Dr. Smith, a compassionate geriatric specialist analyzing patient conversations."
                },
                {
                    "role": "user",
                    "content": analysis_prompt
                }
            ],
            max_tokens=800,
            temperature=0.3
        )
        
        assessment = response.choices[0].message.content
        
        return {
            "status": "success",
            "session_id": session_id,
            "assessment": assessment,
            "timestamp": str(__import__('datetime').datetime.now())
        }
        
    except Exception as exc:
        print(f"Error analyzing conversation: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


def get_conversation_starter_prompts():
    """
    Get friendly conversation starter prompts for elderly patients
    """
    return [
        "Hello! I'm Dr. Smith. It's wonderful to meet you today. How are you feeling?",
        
        "Good morning! I hope you're having a pleasant day. What have you been up to today?",
        
        "Hi there! It's so nice to chat with you. Tell me, how have you been lately?",
        
        "Hello! I'm here to have a friendly conversation with you. Is there anything on your mind today?",
        
        "Welcome! I'm Dr. Smith, and I'm looking forward to our chat. How are things going for you?"
    ]


def get_memory_assessment_questions():
    """
    Natural memory assessment questions for elderly patients
    """
    return [
        "Tell me about something interesting that happened to you recently. What did you do yesterday?",
        
        "Do you have any special memories from your childhood? What was your favorite thing to do when you were young?",
        
        "What did you have for breakfast this morning? Do you remember?",
        
        "Can you tell me about your family? Who do you live with or see regularly?",
        
        "What's your favorite hobby or activity? When did you last do it?",
        
        "Do you remember what we talked about when we first started chatting today?"
    ]


def get_orientation_assessment_questions():
    """
    Natural orientation assessment questions
    """
    return [
        "Can you tell me what day of the week it is today?",
        
        "What season are we in right now? Is it spring, summer, fall, or winter?",
        
        "Where are we right now? Can you describe your surroundings?",
        
        "Do you remember what month it is?",
        
        "What time of day is it - morning, afternoon, or evening?"
    ]


def get_cognitive_exercise_prompts():
    """
    Gentle cognitive exercises presented as friendly challenges
    """
    return [
        "Let's play a little game! If you had to go to the store to buy milk, bread, and eggs, what would you buy? Can you repeat that back to me?",
        
        "Here's a fun one: If you had $10 and bought something for $3, how much would you have left?",
        
        "Let me tell you three words to remember: Apple, Table, Penny. We'll talk about other things, and I'll ask you to repeat them in a few minutes, okay?",
        
        "Can you count backwards from 10 to 1 for me? Take your time!",
        
        "If I say 'blue sky', what words come to your mind? Just say whatever you think of!"
    ]

