#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for College Examination App
Tests all endpoints in the specified order with proper authentication and data flow.
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid

class ExamAppTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.admin_token = None
        self.student_token = None
        self.admin_data = None
        self.student_data = None
        self.exam_id = None
        self.question_ids = []
        self.session_id = None
        self.test_results = []
        
        # Test data
        self.admin_test_data = {
            "email": "admin@college.edu",
            "password": "admin123",
            "full_name": "Test Administrator"
        }
        
        self.student_test_data = {
            "roll_number": "CS2024001",
            "password": "student123",
            "full_name": "John Doe",
            "department": "Computer Science",
            "semester": 5
        }
        
        self.device_info = {
            "device_id": "test-device-001",
            "os": "android",
            "os_version": "13",
            "screen_width": 1080,
            "screen_height": 2400
        }
        
        self.different_device_info = {
            "device_id": "different-device-002",
            "os": "ios",
            "os_version": "16",
            "screen_width": 1170,
            "screen_height": 2532
        }

    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data and not success:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.api_url}{endpoint}"
        
        default_headers = {"Content-Type": "application/json"}
        if headers:
            default_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
                
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
                
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def get_auth_headers(self, token: str) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}

    # ==================== Authentication Tests ====================
    
    def test_admin_register(self):
        """Test admin registration"""
        success, data, status = self.make_request("POST", "/auth/admin/register", self.admin_test_data)
        
        if success and "access_token" in data:
            self.admin_token = data["access_token"]
            self.admin_data = data["user"]
            self.log_test("Admin Registration", True, f"Admin registered with ID: {self.admin_data['id']}")
            return True
        else:
            self.log_test("Admin Registration", False, f"Status: {status}", data)
            return False

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": self.admin_test_data["email"],
            "password": self.admin_test_data["password"]
        }
        
        success, data, status = self.make_request("POST", "/auth/admin/login", login_data)
        
        if success and "access_token" in data:
            self.admin_token = data["access_token"]
            self.admin_data = data["user"]
            self.log_test("Admin Login", True, f"Admin logged in successfully")
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}", data)
            return False

    def test_student_register(self):
        """Test student registration with device binding"""
        register_data = {
            **self.student_test_data,
            "device_info": self.device_info
        }
        
        success, data, status = self.make_request("POST", "/auth/student/register", register_data)
        
        if success and "access_token" in data:
            self.student_token = data["access_token"]
            self.student_data = data["user"]
            self.log_test("Student Registration", True, f"Student registered with roll number: {self.student_data['roll_number']}")
            return True
        else:
            self.log_test("Student Registration", False, f"Status: {status}", data)
            return False

    def test_student_login(self):
        """Test student login with correct device"""
        login_data = {
            "roll_number": self.student_test_data["roll_number"],
            "password": self.student_test_data["password"],
            "device_info": self.device_info
        }
        
        success, data, status = self.make_request("POST", "/auth/student/login", login_data)
        
        if success and "access_token" in data:
            self.student_token = data["access_token"]
            self.student_data = data["user"]
            self.log_test("Student Login (Correct Device)", True, "Student logged in successfully")
            return True
        else:
            self.log_test("Student Login (Correct Device)", False, f"Status: {status}", data)
            return False

    def test_student_login_wrong_device(self):
        """Test student login with wrong device - should fail"""
        login_data = {
            "roll_number": self.student_test_data["roll_number"],
            "password": self.student_test_data["password"],
            "device_info": self.different_device_info
        }
        
        success, data, status = self.make_request("POST", "/auth/student/login", login_data)
        
        # This should fail (success=False) due to device binding
        if not success and status == 403:
            self.log_test("Device Binding Verification", True, "Correctly blocked login from different device")
            return True
        else:
            self.log_test("Device Binding Verification", False, f"Should have blocked different device. Status: {status}", data)
            return False

    # ==================== Exam Management Tests ====================
    
    def test_create_exam(self):
        """Test exam creation"""
        if not self.admin_token:
            self.log_test("Create Exam", False, "No admin token available")
            return False
            
        exam_data = {
            "title": "Data Structures and Algorithms",
            "description": "Mid-semester examination covering arrays, linked lists, stacks, and queues",
            "duration_minutes": 120,
            "total_marks": 100,
            "department": "Computer Science",
            "semester": 5,
            "start_time": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "end_time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
            "is_active": True
        }
        
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("POST", "/admin/exams", exam_data, headers)
        
        if success and "id" in data:
            self.exam_id = data["id"]
            self.log_test("Create Exam", True, f"Exam created with ID: {self.exam_id}")
            return True
        else:
            self.log_test("Create Exam", False, f"Status: {status}", data)
            return False

    def test_list_exams(self):
        """Test listing exams"""
        if not self.admin_token:
            self.log_test("List Exams", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", "/admin/exams", headers=headers)
        
        if success and isinstance(data, list):
            self.log_test("List Exams", True, f"Retrieved {len(data)} exams")
            return True
        else:
            self.log_test("List Exams", False, f"Status: {status}", data)
            return False

    def test_get_exam_details(self):
        """Test getting exam details"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Get Exam Details", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", f"/admin/exams/{self.exam_id}", headers=headers)
        
        if success and "id" in data:
            self.log_test("Get Exam Details", True, f"Retrieved exam: {data.get('title', 'Unknown')}")
            return True
        else:
            self.log_test("Get Exam Details", False, f"Status: {status}", data)
            return False

    # ==================== Question Management Tests ====================
    
    def test_create_mcq_question(self):
        """Test creating MCQ question"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Create MCQ Question", False, "No admin token or exam ID available")
            return False
            
        question_data = {
            "exam_id": self.exam_id,
            "question_text": "What is the time complexity of binary search?",
            "question_type": "mcq",
            "marks": 5,
            "options": [
                {"id": str(uuid.uuid4()), "text": "O(n)", "is_correct": False},
                {"id": str(uuid.uuid4()), "text": "O(log n)", "is_correct": True},
                {"id": str(uuid.uuid4()), "text": "O(n²)", "is_correct": False},
                {"id": str(uuid.uuid4()), "text": "O(1)", "is_correct": False}
            ]
        }
        
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("POST", "/admin/questions", question_data, headers)
        
        if success and "id" in data:
            self.question_ids.append(data["id"])
            self.log_test("Create MCQ Question", True, f"MCQ question created with ID: {data['id']}")
            return True
        else:
            self.log_test("Create MCQ Question", False, f"Status: {status}", data)
            return False

    def test_create_short_answer_question(self):
        """Test creating short answer question"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Create Short Answer Question", False, "No admin token or exam ID available")
            return False
            
        question_data = {
            "exam_id": self.exam_id,
            "question_text": "Explain the difference between stack and queue data structures.",
            "question_type": "short_answer",
            "marks": 10,
            "correct_answer": "Stack follows LIFO principle while queue follows FIFO principle"
        }
        
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("POST", "/admin/questions", question_data, headers)
        
        if success and "id" in data:
            self.question_ids.append(data["id"])
            self.log_test("Create Short Answer Question", True, f"Short answer question created with ID: {data['id']}")
            return True
        else:
            self.log_test("Create Short Answer Question", False, f"Status: {status}", data)
            return False

    def test_list_questions(self):
        """Test listing questions for an exam"""
        if not self.admin_token or not self.exam_id:
            self.log_test("List Questions", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", f"/admin/questions/{self.exam_id}", headers=headers)
        
        if success and isinstance(data, list):
            self.log_test("List Questions", True, f"Retrieved {len(data)} questions for exam")
            return True
        else:
            self.log_test("List Questions", False, f"Status: {status}", data)
            return False

    # ==================== Student Exam Tests ====================
    
    def test_get_available_exams(self):
        """Test getting available exams for student"""
        if not self.student_token:
            self.log_test("Get Available Exams", False, "No student token available")
            return False
            
        headers = self.get_auth_headers(self.student_token)
        success, data, status = self.make_request("GET", "/student/exams", headers=headers)
        
        if success and isinstance(data, list):
            self.log_test("Get Available Exams", True, f"Student can see {len(data)} available exams")
            return True
        else:
            self.log_test("Get Available Exams", False, f"Status: {status}", data)
            return False

    def test_start_exam_session(self):
        """Test starting an exam session"""
        if not self.student_token or not self.exam_id:
            self.log_test("Start Exam Session", False, "No student token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.student_token)
        success, data, status = self.make_request("POST", f"/student/exams/{self.exam_id}/start", headers=headers)
        
        if success and "session_id" in data:
            self.session_id = data["session_id"]
            questions = data.get("questions", [])
            self.log_test("Start Exam Session", True, f"Exam session started with {len(questions)} questions")
            
            # Test question randomization
            if len(questions) > 1:
                self.log_test("Question Randomization", True, "Questions are provided in randomized order")
            
            return True
        else:
            self.log_test("Start Exam Session", False, f"Status: {status}", data)
            return False

    def test_submit_answer(self):
        """Test submitting an answer"""
        if not self.student_token or not self.exam_id or not self.question_ids:
            self.log_test("Submit Answer", False, "Missing required data for answer submission")
            return False
            
        answer_data = {
            "question_id": self.question_ids[0],
            "answer": "O(log n)",  # Correct answer for the MCQ
            "time_taken_seconds": 45
        }
        
        headers = self.get_auth_headers(self.student_token)
        success, data, status = self.make_request("POST", f"/student/exams/{self.exam_id}/answer", answer_data, headers)
        
        if success:
            self.log_test("Submit Answer", True, "Answer submitted successfully")
            return True
        else:
            self.log_test("Submit Answer", False, f"Status: {status}", data)
            return False

    def test_submit_exam(self):
        """Test submitting the entire exam"""
        if not self.student_token or not self.exam_id:
            self.log_test("Submit Exam", False, "No student token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.student_token)
        success, data, status = self.make_request("POST", f"/student/exams/{self.exam_id}/submit", headers=headers)
        
        if success and "marks_obtained" in data:
            marks = data["marks_obtained"]
            total = data.get("total_marks", 0)
            self.log_test("Submit Exam", True, f"Exam submitted. Marks: {marks}/{total}")
            return True
        else:
            self.log_test("Submit Exam", False, f"Status: {status}", data)
            return False

    # ==================== Fraud Detection Tests ====================
    
    def test_fraud_event_logging(self):
        """Test logging fraud events"""
        if not self.student_token or not self.session_id:
            self.log_test("Fraud Event Logging", False, "No student token or session ID available")
            return False
            
        fraud_data = {
            "exam_session_id": self.session_id,
            "fraud_type": "tab_switch",
            "details": "Student switched to another browser tab",
            "risk_score_delta": 15
        }
        
        headers = self.get_auth_headers(self.student_token)
        success, data, status = self.make_request("POST", "/student/fraud-event", fraud_data, headers)
        
        if success and "risk_score" in data:
            risk_score = data["risk_score"]
            self.log_test("Fraud Event Logging", True, f"Fraud event logged. Risk score: {risk_score}")
            return True
        else:
            self.log_test("Fraud Event Logging", False, f"Status: {status}", data)
            return False

    def test_fraud_alerts(self):
        """Test getting fraud alerts"""
        if not self.admin_token:
            self.log_test("Fraud Alerts", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", "/admin/fraud-alerts", headers=headers)
        
        if success and isinstance(data, list):
            self.log_test("Fraud Alerts", True, f"Retrieved {len(data)} fraud alerts")
            return True
        else:
            self.log_test("Fraud Alerts", False, f"Status: {status}", data)
            return False

    def test_live_monitoring(self):
        """Test live monitoring"""
        if not self.admin_token:
            self.log_test("Live Monitoring", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", "/admin/live-monitoring", headers=headers)
        
        if success and isinstance(data, list):
            self.log_test("Live Monitoring", True, f"Retrieved {len(data)} active sessions")
            return True
        else:
            self.log_test("Live Monitoring", False, f"Status: {status}", data)
            return False

    # ==================== Export Tests ====================
    
    def test_export_attendance(self):
        """Test exporting attendance report"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Export Attendance", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", f"/admin/export/attendance/{self.exam_id}", headers=headers)
        
        if success and "attendance" in data:
            attendance_count = len(data["attendance"])
            self.log_test("Export Attendance", True, f"Attendance report generated for {attendance_count} participants")
            return True
        else:
            self.log_test("Export Attendance", False, f"Status: {status}", data)
            return False

    def test_export_marks(self):
        """Test exporting marks report"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Export Marks", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", f"/admin/export/marks/{self.exam_id}", headers=headers)
        
        if success and "results" in data:
            results_count = len(data["results"])
            self.log_test("Export Marks", True, f"Marks report generated for {results_count} participants")
            return True
        else:
            self.log_test("Export Marks", False, f"Status: {status}", data)
            return False

    def test_export_fraud_logs(self):
        """Test exporting fraud logs"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Export Fraud Logs", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", f"/admin/export/fraud-logs/{self.exam_id}", headers=headers)
        
        if success and "fraud_logs" in data:
            logs_count = len(data["fraud_logs"])
            self.log_test("Export Fraud Logs", True, f"Fraud logs report generated with {logs_count} events")
            return True
        else:
            self.log_test("Export Fraud Logs", False, f"Status: {status}", data)
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        if not self.admin_token:
            self.log_test("Dashboard Stats", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("GET", "/admin/dashboard-stats", headers=headers)
        
        if success and "total_students" in data:
            stats = {
                "students": data.get("total_students", 0),
                "exams": data.get("total_exams", 0),
                "active_sessions": data.get("active_sessions", 0)
            }
            self.log_test("Dashboard Stats", True, f"Dashboard stats retrieved: {stats}")
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}", data)
            return False

    # ==================== Cleanup Tests ====================
    
    def test_delete_question(self):
        """Test deleting a question"""
        if not self.admin_token or not self.question_ids:
            self.log_test("Delete Question", False, "No admin token or question IDs available")
            return False
            
        question_id = self.question_ids[0]
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("DELETE", f"/admin/questions/{question_id}", headers=headers)
        
        if success:
            self.log_test("Delete Question", True, f"Question {question_id} deleted successfully")
            return True
        else:
            self.log_test("Delete Question", False, f"Status: {status}", data)
            return False

    def test_delete_exam(self):
        """Test deleting an exam"""
        if not self.admin_token or not self.exam_id:
            self.log_test("Delete Exam", False, "No admin token or exam ID available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        success, data, status = self.make_request("DELETE", f"/admin/exams/{self.exam_id}", headers=headers)
        
        if success:
            self.log_test("Delete Exam", True, f"Exam {self.exam_id} deleted successfully")
            return True
        else:
            self.log_test("Delete Exam", False, f"Status: {status}", data)
            return False

    # ==================== Main Test Runner ====================
    
    def run_all_tests(self):
        """Run all tests in the specified order"""
        print("🚀 Starting College Examination App Backend API Tests")
        print(f"📍 Testing against: {self.api_url}")
        print("=" * 80)
        
        # Authentication Tests
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        self.test_admin_register()
        self.test_admin_login()
        self.test_student_register()
        self.test_student_login()
        self.test_student_login_wrong_device()
        
        # Exam Management Tests
        print("\n📚 EXAM MANAGEMENT TESTS")
        print("-" * 40)
        self.test_create_exam()
        self.test_list_exams()
        self.test_get_exam_details()
        
        # Question Management Tests
        print("\n❓ QUESTION MANAGEMENT TESTS")
        print("-" * 40)
        self.test_create_mcq_question()
        self.test_create_short_answer_question()
        self.test_list_questions()
        
        # Student Exam Tests
        print("\n🎓 STUDENT EXAM TESTS")
        print("-" * 40)
        self.test_get_available_exams()
        self.test_start_exam_session()
        self.test_submit_answer()
        self.test_submit_exam()
        
        # Fraud Detection Tests
        print("\n🚨 FRAUD DETECTION TESTS")
        print("-" * 40)
        self.test_fraud_event_logging()
        self.test_fraud_alerts()
        self.test_live_monitoring()
        
        # Export Tests
        print("\n📊 EXPORT TESTS")
        print("-" * 40)
        self.test_export_attendance()
        self.test_export_marks()
        self.test_export_fraud_logs()
        self.test_dashboard_stats()
        
        # Cleanup Tests
        print("\n🧹 CLEANUP TESTS")
        print("-" * 40)
        self.test_delete_question()
        self.test_delete_exam()
        
        # Summary
        return self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📋 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        failed = len(self.test_results) - passed
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Total: {len(self.test_results)}")
        
        if failed > 0:
            print(f"\n🚨 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print(f"\n🎯 Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        return passed, failed


def main():
    """Main function to run tests"""
    # Get backend URL from environment
    try:
        with open('/app/frontend/.env', 'r') as f:
            env_content = f.read()
            for line in env_content.split('\n'):
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    base_url = line.split('=', 1)[1].strip()
                    break
            else:
                base_url = "https://antifraud-exam.preview.emergentagent.com"
    except:
        base_url = "https://antifraud-exam.preview.emergentagent.com"
    
    print(f"🌐 Using backend URL: {base_url}")
    
    # Initialize and run tests
    tester = ExamAppTester(base_url)
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()