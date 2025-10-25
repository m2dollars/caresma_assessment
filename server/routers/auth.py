from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()

class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    age: int
    emergency_contact: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str

@router.post("/register")
async def register_user(user: UserRegister):
    """Register a new user (simplified for demo)"""
    user_id = str(uuid.uuid4())
    
    # In a real app, you'd hash the password and store in database
    return {
        "user_id": user_id,
        "message": "User registered successfully",
        "username": user.username
    }

@router.post("/login", response_model=TokenResponse)
async def login_user(credentials: UserLogin):
    """Login user (simplified for demo)"""
    # In a real app, you'd verify credentials against database
    user_id = str(uuid.uuid4())
    
    return TokenResponse(
        access_token="demo_token_" + user_id,
        token_type="bearer",
        user_id=user_id
    )
