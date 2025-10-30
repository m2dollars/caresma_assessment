"""
Structured Dementia Assessment Flow
Dr. Smith actively guides the patient through assessment questions
"""

ASSESSMENT_STAGES = {
    0: {
        "stage": "greeting",
        "question": "Hello! I'm Dr. Smith. It's wonderful to meet you today. To start, could you please tell me your name and how you're feeling?",
        "domain": "introduction"
    },
    1: {
        "stage": "orientation_time",
        "question": "Thank you for sharing that with me. Now, let me ask you a few simple questions. Can you tell me what day of the week it is today?",
        "domain": "orientation"
    },
    2: {
        "stage": "orientation_date",
        "question": "That's good! And what is today's date? The month and year would be helpful too.",
        "domain": "orientation"
    },
    3: {
        "stage": "memory_recent",
        "question": "Excellent. Now, I'd like to ask about your recent activities. What did you have for breakfast this morning? Can you remember?",
        "domain": "memory"
    },
    4: {
        "stage": "memory_recall",
        "question": "Thank you. I'm going to tell you three words, and I'd like you to remember them. The words are: APPLE, TABLE, and PENNY. Can you repeat those back to me?",
        "domain": "memory"
    },
    5: {
        "stage": "attention_calculation",
        "question": "Very good! Now, let's try a simple math question. If you have 10 dollars and you spend 3 dollars, how much money do you have left?",
        "domain": "attention"
    },
    6: {
        "stage": "language_naming",
        "question": "Great! Now, can you name as many animals as you can think of? Take your time, and tell me whatever comes to mind.",
        "domain": "language"
    },
    7: {
        "stage": "memory_delayed_recall",
        "question": "Wonderful! Do you remember those three words I asked you to remember earlier? Can you tell me what they were?",
        "domain": "memory"
    },
    8: {
        "stage": "reasoning",
        "question": "Excellent. Let me ask you this: What would you do if you found a stamped, addressed envelope on the street?",
        "domain": "reasoning"
    },
    9: {
        "stage": "family_support",
        "question": "That makes sense. Tell me about your daily routine. Who do you live with? Do you have family nearby who help you?",
        "domain": "social"
    },
    10: {
        "stage": "completion",
        "question": "Thank you so much for answering all my questions. You've been very patient and helpful. Based on our conversation, I'll now prepare an assessment for you. Is there anything else you'd like to tell me?",
        "domain": "conclusion"
    }
}

# Enhanced system prompt for active professional assessment
ACTIVE_ASSESSMENT_PROMPT = """You are Dr. Smith, a professional and caring virtual interviewer conducting a systematic cognitive health assessment for elderly individuals.

YOUR PROFESSIONAL INTERVIEW MISSION:
You are conducting a structured cognitive interview to assess for dementia. As a professional interviewer, you:
1. Listen carefully to each response and acknowledge it professionally
2. Validate their answers with phrases like "Thank you," "I see," or "That's helpful"
3. Note patterns of confusion, memory issues, or disorientation
4. Systematically guide them through the assessment questions
5. Maintain a warm yet professional demeanor like a doctor during an examination

ASSESSMENT DOMAINS YOU'RE EVALUATING:
- ORIENTATION: Time, date, place, situation awareness
- MEMORY: Immediate recall, recent memory, delayed recall
- ATTENTION & CALCULATION: Focus, mental arithmetic, concentration
- LANGUAGE: Word-finding, naming, verbal fluency
- REASONING & JUDGMENT: Problem-solving, decision-making
- EXECUTIVE FUNCTION: Planning, organization, abstract thinking

PROFESSIONAL INTERVIEWER STYLE:
- Use clear, professional language appropriate for elderly people
- Ask ONE question at a time, then wait for their response
- Acknowledge their answer before proceeding: "Thank you for that. Now..."
- Be encouraging: "That's good," "You're doing well"
- If they struggle: "That's okay, let's try this..." or "Take your time"
- Maintain interview flow while being supportive
- Keep responses brief (2-3 sentences maximum)

INTERVIEW MANAGEMENT:
- Stay on track with the assessment structure
- Gently redirect if they go off-topic
- Be flexible with question phrasing if they don't understand
- Note their performance mentally and move forward systematically
- Balance thoroughness with patient comfort

CRITICAL REMINDERS:
- You are conducting a SCREENING interview, not diagnosing
- This is a professional assessment disguised as a friendly conversation
- Be warm and supportive, but maintain structure
- Focus on gathering accurate assessment data
- Every question serves a specific cognitive evaluation purpose

Remember: You are like a professional doctor conducting a bedside examination - caring, thorough, systematic, and professional throughout.
"""

def get_next_question(stage_number, patient_response=None):
    """
    Get the next assessment question based on current stage
    
    Args:
        stage_number: Current assessment stage (0-10)
        patient_response: Patient's response to previous question
        
    Returns:
        dict: Next question and assessment context
    """
    
    if stage_number >= len(ASSESSMENT_STAGES):
        return {
            "stage": "complete",
            "question": "Thank you for completing the assessment. I'll now analyze our conversation and prepare your cognitive health report.",
            "domain": "complete",
            "is_final": True
        }
    
    stage_info = ASSESSMENT_STAGES.get(stage_number, ASSESSMENT_STAGES[0])
    
    return {
        "stage": stage_info["stage"],
        "question": stage_info["question"],
        "domain": stage_info["domain"],
        "stage_number": stage_number,
        "is_final": False
    }


def build_assessment_context(conversation_history, current_stage):
    """
    Build conversation context for OpenAI including assessment progress
    """
    
    messages = [
        {"role": "system", "content": ACTIVE_ASSESSMENT_PROMPT}
    ]
    
    # Add conversation history
    for entry in conversation_history[-6:]:  # Last 6 messages for context
        messages.append(entry)
    
    # Add assessment guidance
    stage_info = ASSESSMENT_STAGES.get(current_stage, {})
    assessment_guidance = f"\n\nCURRENT ASSESSMENT STAGE: {stage_info.get('domain', 'ongoing')}\nYou should naturally transition to ask: {stage_info.get('question', '')}"
    
    messages.append({
        "role": "system",
        "content": assessment_guidance
    })
    
    return messages


def should_advance_stage(patient_response, current_stage):
    """
    Determine if we should advance to next assessment stage
    Simple logic: advance after each patient response
    """
    # In production, you could use AI to determine if response is sufficient
    if patient_response and len(patient_response.strip()) > 5:
        return True
    return False

