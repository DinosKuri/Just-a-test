#!/usr/bin/env python3
"""
Test auto-submit functionality when risk score exceeds 80
"""

import requests
import json
from datetime import datetime, timedelta
import uuid

def test_auto_submit():
    base_url = "https://antifraud-exam.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Login as existing admin
    admin_login = {
        "email": "admin@college.edu",
        "password": "admin123"
    }
    
    response = requests.post(f"{api_url}/auth/admin/login", json=admin_login)
    if response.status_code != 200:
        print("❌ Admin login failed")
        return
    
    admin_token = response.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Create a new exam for testing
    exam_data = {
        "title": "Auto-Submit Test Exam",
        "description": "Testing auto-submit when risk score exceeds 80",
        "duration_minutes": 60,
        "total_marks": 50,
        "department": "Computer Science",
        "semester": 5,
        "start_time": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "end_time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        "is_active": True
    }
    
    response = requests.post(f"{api_url}/admin/exams", json=exam_data, headers=admin_headers)
    if response.status_code != 200:
        print("❌ Exam creation failed")
        return
    
    exam_id = response.json()["id"]
    print(f"✅ Created test exam: {exam_id}")
    
    # Add a question
    question_data = {
        "exam_id": exam_id,
        "question_text": "What is the capital of France?",
        "question_type": "mcq",
        "marks": 5,
        "options": [
            {"id": str(uuid.uuid4()), "text": "London", "is_correct": False},
            {"id": str(uuid.uuid4()), "text": "Paris", "is_correct": True},
            {"id": str(uuid.uuid4()), "text": "Berlin", "is_correct": False},
            {"id": str(uuid.uuid4()), "text": "Madrid", "is_correct": False}
        ]
    }
    
    response = requests.post(f"{api_url}/admin/questions", json=question_data, headers=admin_headers)
    if response.status_code != 200:
        print("❌ Question creation failed")
        return
    
    print("✅ Added question to exam")
    
    # Login as existing student
    student_login = {
        "roll_number": "CS2024001",
        "password": "student123",
        "device_info": {
            "device_id": "test-device-001",
            "os": "android",
            "os_version": "13",
            "screen_width": 1080,
            "screen_height": 2400
        }
    }
    
    response = requests.post(f"{api_url}/auth/student/login", json=student_login)
    if response.status_code != 200:
        print("❌ Student login failed")
        return
    
    student_token = response.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    # Start exam session
    response = requests.post(f"{api_url}/student/exams/{exam_id}/start", headers=student_headers)
    if response.status_code != 200:
        print("❌ Failed to start exam session")
        return
    
    session_id = response.json()["session_id"]
    print(f"✅ Started exam session: {session_id}")
    
    # Log multiple fraud events to exceed risk score of 80
    fraud_events = [
        {"fraud_type": "tab_switch", "details": "Switched to another tab", "risk_score_delta": 25},
        {"fraud_type": "window_blur", "details": "Window lost focus", "risk_score_delta": 20},
        {"fraud_type": "copy_paste", "details": "Copy-paste detected", "risk_score_delta": 30},
        {"fraud_type": "suspicious_behavior", "details": "Multiple violations", "risk_score_delta": 15}
    ]
    
    current_risk_score = 0
    for event in fraud_events:
        fraud_data = {
            "exam_session_id": session_id,
            **event
        }
        
        response = requests.post(f"{api_url}/student/fraud-event", json=fraud_data, headers=student_headers)
        if response.status_code == 200:
            current_risk_score = response.json()["risk_score"]
            print(f"✅ Logged fraud event: {event['fraud_type']} (Risk Score: {current_risk_score})")
            
            if current_risk_score >= 80:
                print(f"🚨 Risk score exceeded 80! Current score: {current_risk_score}")
                break
        else:
            print(f"❌ Failed to log fraud event: {event['fraud_type']}")
    
    # Check if exam was auto-submitted
    response = requests.get(f"{api_url}/admin/live-monitoring", headers=admin_headers)
    if response.status_code == 200:
        sessions = response.json()
        auto_submitted_session = None
        for session in sessions:
            if session["session_id"] == session_id:
                auto_submitted_session = session
                break
        
        if not auto_submitted_session:
            print("✅ Exam was auto-submitted (no longer in active sessions)")
        else:
            print(f"⚠️ Exam session still active with risk score: {auto_submitted_session.get('risk_score', 0)}")
    
    # Cleanup - delete the test exam
    response = requests.delete(f"{api_url}/admin/exams/{exam_id}", headers=admin_headers)
    if response.status_code == 200:
        print("✅ Cleaned up test exam")
    else:
        print("⚠️ Failed to cleanup test exam")

if __name__ == "__main__":
    print("🧪 Testing Auto-Submit Functionality")
    print("=" * 50)
    test_auto_submit()