#!/usr/bin/env python3
"""
Test script to verify Dementia Detection AI setup
"""

import requests
import time
import sys
import os
from dotenv import load_dotenv

def test_environment():
    """Test environment configuration"""
    print("Testing environment configuration...")
    
    load_dotenv()
    
    required_vars = [
        'OPENAI_API_KEY',
        'DEEPGRAM_API_KEY', 
        'ELEVENLABS_API_KEY',
        'REDIS_URL'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Missing environment variables: {', '.join(missing_vars)}")
        print("Please check your .env file")
        return False
    
    print("Environment variables configured")
    return True

def test_redis_connection():
    """Test Redis connection"""
    print("Testing Redis connection...")
    
    try:
        import redis
        r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
        r.ping()
        print("Redis connection successful")
        return True
    except Exception as e:
        print(f"Redis connection failed: {e}")
        print("Make sure Redis server is running")
        return False

def test_backend_api():
    """Test backend API"""
    print("Testing backend API...")
    
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("Backend API is running")
            return True
        else:
            print(f"Backend API returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("Backend API is not running")
        print("Start the backend with: cd server && uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"Backend API test failed: {e}")
        return False

def test_frontend():
    """Test frontend"""
    print("Testing frontend...")
    
    try:
        response = requests.get('http://localhost:3000', timeout=5)
        if response.status_code == 200:
            print("Frontend is running")
            return True
        else:
            print(f"Frontend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("Frontend is not running")
        print("Start the frontend with: cd client && npm start")
        return False
    except Exception as e:
        print(f"Frontend test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Dementia Detection AI - Setup Test")
    print("=" * 50)
    
    tests = [
        test_environment,
        test_redis_connection,
        test_backend_api,
        test_frontend
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("All tests passed! System is ready to use.")
        print("\nAccess the application:")
        print("   Frontend: http://localhost:3000")
        print("   Backend API: http://localhost:8000")
        print("   API Docs: http://localhost:8000/docs")
    else:
        print("Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
