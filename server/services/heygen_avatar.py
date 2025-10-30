"""
HeyGen Streaming Avatar Integration
Creates beautiful, photo-realistic real-time talking doctor avatars
"""

import os
import aiohttp
import asyncio
import json
from typing import Optional, Dict

class HeyGenStreamingAvatar:
    """HeyGen Streaming Avatar API client for real-time talking avatars"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.heygen.com/v1"
        self.headers = {
            "X-Api-Key": api_key,
            "Content-Type": "application/json"
        }
        
        # Professional female doctor avatar (similar to the picture)
        # You can change this to any HeyGen avatar ID
        self.doctor_avatar_id = "Anna_public_3_20240108"  # Professional female presenter
        self.voice_id = "1bd001e7e50f421d891986aad5158bc8"  # Professional female voice
        
    async def create_streaming_session(self) -> Dict:
        """
        Create a new streaming avatar session
        
        Returns:
            dict with session_id and streaming URLs
        """
        endpoint = f"{self.base_url}/streaming.new"
        
        payload = {
            "quality": "high",
            "avatar_name": self.doctor_avatar_id,
            "voice": {
                "voice_id": self.voice_id
            }
        }
        
        print(f"HeyGen: Creating session at {endpoint}")
        print(f"HeyGen: Payload: {payload}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload, headers=self.headers) as response:
                    response_text = await response.text()
                    print(f"HeyGen: Response status: {response.status}")
                    print(f"HeyGen: Response body: {response_text}")
                    
                    if response.status == 200:
                        result = json.loads(response_text)
                        print(f"HeyGen: Parsed response: {result}")
                        
                        # HeyGen wraps data in {"code": 100, "data": {...}, "message": "success"}
                        data = result.get("data", {})
                        
                        # Extract ICE servers from ice_servers2 array
                        ice_servers_raw = data.get("ice_servers2", [])
                        ice_servers = []
                        if isinstance(ice_servers_raw, list):
                            ice_servers = ice_servers_raw
                        
                        return {
                            "success": True,
                            "session_id": data.get("session_id"),
                            "sdp": data.get("sdp", {}).get("sdp"),  # Extract sdp string from sdp object
                            "ice_servers": ice_servers,
                            "access_token": data.get("access_token"),
                            "url": data.get("url")
                        }
                    else:
                        error_msg = f"HeyGen API error: {response.status} - {response_text}"
                        print(f"HeyGen: ERROR: {error_msg}")
                        return {
                            "success": False,
                            "error": error_msg
                        }
        except Exception as e:
            error_msg = f"Exception creating session: {str(e)}"
            print(f"HeyGen: EXCEPTION: {error_msg}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": error_msg
            }
    
    async def start_streaming(self, session_id: str, sdp_answer: str) -> Dict:
        """
        Start the streaming session with SDP answer
        
        Args:
            session_id: The session ID from create_streaming_session
            sdp_answer: SDP answer from the client
            
        Returns:
            dict with success status
        """
        endpoint = f"{self.base_url}/streaming.start"
        
        payload = {
            "session_id": session_id,
            "sdp": {
                "type": "answer",
                "sdp": sdp_answer
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload, headers=self.headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("code") == 100:
                            return {"success": True, "data": result.get("data", {})}
                        else:
                            return {
                                "success": False,
                                "error": f"HeyGen returned code {result.get('code')}: {result.get('message')}"
                            }
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "error": f"Start streaming error: {response.status} - {error_text}"
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception starting stream: {str(e)}"
            }
    
    async def send_message(self, session_id: str, text: str, task_type: str = "talk") -> Dict:
        """
        Send a message for the avatar to speak
        
        Args:
            session_id: The active session ID
            text: Text for the avatar to speak
            task_type: Type of task (talk, repeat, etc)
            
        Returns:
            dict with task_id
        """
        endpoint = f"{self.base_url}/streaming.task"
        
        payload = {
            "session_id": session_id,
            "text": text,
            "task_type": task_type
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload, headers=self.headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("code") == 100:
                            data = result.get("data", {})
                            return {
                                "success": True,
                                "task_id": data.get("task_id"),
                                "duration_ms": data.get("duration_ms")
                            }
                        else:
                            return {
                                "success": False,
                                "error": f"HeyGen returned code {result.get('code')}: {result.get('message')}"
                            }
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "error": f"Send message error: {response.status} - {error_text}"
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception sending message: {str(e)}"
            }
    
    async def stop_session(self, session_id: str) -> Dict:
        """
        Stop a streaming session
        
        Args:
            session_id: The session ID to stop
            
        Returns:
            dict with success status
        """
        endpoint = f"{self.base_url}/streaming.stop"
        
        payload = {
            "session_id": session_id
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload, headers=self.headers) as response:
                    if response.status == 200:
                        return {"success": True}
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "error": f"Stop session error: {response.status} - {error_text}"
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception stopping session: {str(e)}"
            }
    
    async def list_avatars(self) -> Dict:
        """
        List available avatars
        
        Returns:
            dict with avatars list
        """
        endpoint = f"{self.base_url}/avatars"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, headers=self.headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "avatars": data.get("avatars", [])
                        }
                    else:
                        return {"success": False, "error": "Failed to list avatars"}
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception listing avatars: {str(e)}"
            }


# Helper functions
async def create_heygen_session(api_key: str) -> Dict:
    """
    Create a HeyGen streaming session
    
    Args:
        api_key: HeyGen API key
        
    Returns:
        dict with session info
    """
    client = HeyGenStreamingAvatar(api_key)
    return await client.create_streaming_session()


async def send_heygen_message(api_key: str, session_id: str, text: str) -> Dict:
    """
    Send a message to HeyGen avatar
    
    Args:
        api_key: HeyGen API key
        session_id: Active session ID
        text: Text to speak
        
    Returns:
        dict with task info
    """
    client = HeyGenStreamingAvatar(api_key)
    return await client.send_message(session_id, text)

