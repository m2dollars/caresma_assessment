#!/usr/bin/env python3
"""
Demo script to test the Dementia Detection AI system
"""

import requests
import json
import time

def test_backend_health():
    """Test if backend is running"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend not accessible: {e}")
        return False

def test_sample_transcript():
    """Test sample transcript endpoint"""
    try:
        response = requests.get('http://localhost:8000/api/report/sample-transcript', timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ Sample transcript loaded successfully")
            print(f"   Transcript length: {len(data['transcript'])} characters")
            return data['transcript']
        else:
            print(f"❌ Failed to load sample transcript: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error loading sample transcript: {e}")
        return None

def test_report_generation(transcript):
    """Test report generation"""
    try:
        print("🔄 Generating report...")
        response = requests.post('http://localhost:8000/api/report/generate', 
                               json={'transcript': transcript, 'session_id': 'demo_test'}, 
                               timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Report generated successfully")
            print(f"   Overall Risk: {data['overall_risk']}")
            print(f"   Memory Score: {data['memory_score']}/10")
            print(f"   Language Score: {data['language_score']}/10")
            print(f"   Attention Score: {data['attention_score']}/10")
            print(f"   Executive Score: {data['executive_score']}/10")
            print(f"   Orientation Score: {data['orientation_score']}/10")
            return True
        else:
            print(f"❌ Report generation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        return False

def main():
    """Run demo tests"""
    print("🧠 Dementia Detection AI - Demo Test")
    print("=" * 50)
    
    # Test 1: Backend Health
    if not test_backend_health():
        print("\n❌ Backend is not running. Please start the backend first:")
        print("   cd server && uvicorn main:app --reload")
        return
    
    # Test 2: Sample Transcript
    transcript = test_sample_transcript()
    if not transcript:
        print("\n❌ Could not load sample transcript")
        return
    
    # Test 3: Report Generation
    if test_report_generation(transcript):
        print("\n🎉 Demo completed successfully!")
        print("\n📱 To test the full system:")
        print("   1. Start Redis: docker run -d -p 6379:6379 redis:7-alpine")
        print("   2. Start Celery: celery -A server.services.celery_app worker --loglevel=info")
        print("   3. Start Frontend: cd client && npm start")
        print("   4. Open: http://localhost:3000")
    else:
        print("\n❌ Demo failed. Check the backend logs for errors.")

if __name__ == "__main__":
    main()
