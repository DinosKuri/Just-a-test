from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import random
import asyncio
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'exam-app-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="College Examination App", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class UserBase(BaseModel):
    full_name: str
    roll_number: str
    department: str
    semester: int

class StudentRegister(UserBase):
    password: str
    device_info: Dict[str, Any]

class AdminRegister(BaseModel):
    full_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    roll_number: str
    password: str
    device_info: Dict[str, Any]

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    full_name: str
    roll_number: str
    department: str
    semester: int
    role: str
    created_at: datetime

class AdminResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# Question Models
class QuestionOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    is_correct: bool = False

class QuestionCreate(BaseModel):
    exam_id: str
    question_text: str
    question_type: str  # "mcq" or "short_answer"
    options: Optional[List[QuestionOption]] = None
    correct_answer: Optional[str] = None
    marks: int = 1
    image_base64: Optional[str] = None
    variants: Optional[List[Dict[str, Any]]] = None  # For randomization

class QuestionResponse(BaseModel):
    id: str
    exam_id: str
    question_text: str
    question_type: str
    options: Optional[List[Dict[str, Any]]] = None
    marks: int
    image_base64: Optional[str] = None

# Exam Models
class ExamCreate(BaseModel):
    title: str
    description: str
    duration_minutes: int
    total_marks: int
    department: str
    semester: int
    start_time: datetime
    end_time: datetime
    is_active: bool = True

class ExamResponse(BaseModel):
    id: str
    title: str
    description: str
    duration_minutes: int
    total_marks: int
    department: str
    semester: int
    start_time: datetime
    end_time: datetime
    is_active: bool
    question_count: int = 0
    created_at: datetime

# Exam Session Models
class AnswerSubmit(BaseModel):
    question_id: str
    answer: str
    time_taken_seconds: int

class ExamSubmission(BaseModel):
    exam_id: str
    answers: List[AnswerSubmit]

class FraudEvent(BaseModel):
    fraud_type: str
    details: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class FraudLogCreate(BaseModel):
    exam_session_id: str
    fraud_type: str
    details: str
    risk_score_delta: int

class FraudLogResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    roll_number: str
    exam_id: str
    exam_title: str
    fraud_type: str
    details: str
    risk_score: int
    timestamp: datetime

class ExamSessionResponse(BaseModel):
    id: str
    student_id: str
    exam_id: str
    start_time: datetime
    end_time: Optional[datetime]
    risk_score: int
    status: str
    fraud_events: List[FraudEvent]

# ==================== Helper Functions ====================

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("sub")
    role = payload.get("role")
    
    if role == "admin":
        user = await db.admins.find_one({"_id": ObjectId(user_id)})
    else:
        user = await db.students.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["id"] = str(user["_id"])
    user["role"] = role
    return user

async def require_admin(current_user: Dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_student(current_user: Dict = Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    return current_user

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def generate_device_fingerprint(device_info: Dict[str, Any]) -> str:
    """Generate a unique fingerprint from device info"""
    parts = [
        str(device_info.get("device_id", "")),
        str(device_info.get("os", "")),
        str(device_info.get("os_version", "")),
        str(device_info.get("screen_width", "")),
        str(device_info.get("screen_height", ""))
    ]
    return "-".join(parts)

# ==================== Authentication Routes ====================

@api_router.post("/auth/student/register", response_model=TokenResponse)
async def register_student(data: StudentRegister):
    # Check if roll number exists
    existing = await db.students.find_one({"roll_number": data.roll_number})
    if existing:
        raise HTTPException(status_code=400, detail="Roll number already registered")
    
    device_fingerprint = generate_device_fingerprint(data.device_info)
    
    # Create student
    student = {
        "full_name": data.full_name,
        "roll_number": data.roll_number,
        "department": data.department,
        "semester": data.semester,
        "password_hash": hash_password(data.password),
        "device_fingerprint": device_fingerprint,
        "device_info": data.device_info,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.students.insert_one(student)
    student_id = str(result.inserted_id)
    
    # Create device binding
    await db.device_bindings.insert_one({
        "student_id": student_id,
        "roll_number": data.roll_number,
        "device_fingerprint": device_fingerprint,
        "device_info": data.device_info,
        "bound_at": datetime.utcnow(),
        "is_active": True
    })
    
    token = create_token(student_id, "student")
    
    return TokenResponse(
        access_token=token,
        user={
            "id": student_id,
            "full_name": data.full_name,
            "roll_number": data.roll_number,
            "department": data.department,
            "semester": data.semester,
            "role": "student"
        }
    )

@api_router.post("/auth/student/login", response_model=TokenResponse)
async def login_student(data: LoginRequest):
    student = await db.students.find_one({"roll_number": data.roll_number})
    if not student:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, student["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify device fingerprint
    device_fingerprint = generate_device_fingerprint(data.device_info)
    
    if student.get("device_fingerprint") and student["device_fingerprint"] != device_fingerprint:
        # Log unauthorized device attempt
        await db.security_logs.insert_one({
            "student_id": str(student["_id"]),
            "roll_number": data.roll_number,
            "event_type": "unauthorized_device_login",
            "device_info": data.device_info,
            "expected_fingerprint": student["device_fingerprint"],
            "actual_fingerprint": device_fingerprint,
            "timestamp": datetime.utcnow()
        })
        raise HTTPException(
            status_code=403, 
            detail="This account is bound to a different device. Contact administrator."
        )
    
    student_id = str(student["_id"])
    token = create_token(student_id, "student")
    
    return TokenResponse(
        access_token=token,
        user={
            "id": student_id,
            "full_name": student["full_name"],
            "roll_number": student["roll_number"],
            "department": student["department"],
            "semester": student["semester"],
            "role": "student"
        }
    )

@api_router.post("/auth/admin/register", response_model=TokenResponse)
async def register_admin(data: AdminRegister):
    existing = await db.admins.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    admin = {
        "full_name": data.full_name,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.admins.insert_one(admin)
    admin_id = str(result.inserted_id)
    token = create_token(admin_id, "admin")
    
    return TokenResponse(
        access_token=token,
        user={
            "id": admin_id,
            "full_name": data.full_name,
            "email": data.email,
            "role": "admin"
        }
    )

@api_router.post("/auth/admin/login", response_model=TokenResponse)
async def login_admin(data: AdminLoginRequest):
    admin = await db.admins.find_one({"email": data.email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    admin_id = str(admin["_id"])
    token = create_token(admin_id, "admin")
    
    return TokenResponse(
        access_token=token,
        user={
            "id": admin_id,
            "full_name": admin["full_name"],
            "email": admin["email"],
            "role": "admin"
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user: Dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "full_name": current_user.get("full_name"),
        "role": current_user.get("role"),
        "email": current_user.get("email"),
        "roll_number": current_user.get("roll_number"),
        "department": current_user.get("department"),
        "semester": current_user.get("semester")
    }

# ==================== Exam Routes (Admin) ====================

@api_router.post("/admin/exams", response_model=ExamResponse)
async def create_exam(data: ExamCreate, admin: Dict = Depends(require_admin)):
    exam = {
        "title": data.title,
        "description": data.description,
        "duration_minutes": data.duration_minutes,
        "total_marks": data.total_marks,
        "department": data.department,
        "semester": data.semester,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "is_active": data.is_active,
        "created_by": admin["id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.exams.insert_one(exam)
    exam_id = str(result.inserted_id)
    
    return ExamResponse(
        id=exam_id,
        title=data.title,
        description=data.description,
        duration_minutes=data.duration_minutes,
        total_marks=data.total_marks,
        department=data.department,
        semester=data.semester,
        start_time=data.start_time,
        end_time=data.end_time,
        is_active=data.is_active,
        question_count=0,
        created_at=exam["created_at"]
    )

@api_router.get("/admin/exams", response_model=List[ExamResponse])
async def list_exams(admin: Dict = Depends(require_admin)):
    exams = await db.exams.find().to_list(1000)
    results = []
    for exam in exams:
        question_count = await db.questions.count_documents({"exam_id": str(exam["_id"])})
        results.append(ExamResponse(
            id=str(exam["_id"]),
            title=exam["title"],
            description=exam["description"],
            duration_minutes=exam["duration_minutes"],
            total_marks=exam["total_marks"],
            department=exam["department"],
            semester=exam["semester"],
            start_time=exam["start_time"],
            end_time=exam["end_time"],
            is_active=exam["is_active"],
            question_count=question_count,
            created_at=exam["created_at"]
        ))
    return results

@api_router.get("/admin/exams/{exam_id}")
async def get_exam(exam_id: str, admin: Dict = Depends(require_admin)):
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    question_count = len(questions)
    
    return {
        "id": str(exam["_id"]),
        "title": exam["title"],
        "description": exam["description"],
        "duration_minutes": exam["duration_minutes"],
        "total_marks": exam["total_marks"],
        "department": exam["department"],
        "semester": exam["semester"],
        "start_time": exam["start_time"],
        "end_time": exam["end_time"],
        "is_active": exam["is_active"],
        "question_count": question_count,
        "created_at": exam["created_at"],
        "questions": [{
            "id": str(q["_id"]),
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "marks": q["marks"],
            "image_base64": q.get("image_base64")
        } for q in questions]
    }

@api_router.put("/admin/exams/{exam_id}")
async def update_exam(exam_id: str, data: ExamCreate, admin: Dict = Depends(require_admin)):
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    update_data = {
        "title": data.title,
        "description": data.description,
        "duration_minutes": data.duration_minutes,
        "total_marks": data.total_marks,
        "department": data.department,
        "semester": data.semester,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "is_active": data.is_active,
        "updated_at": datetime.utcnow()
    }
    
    await db.exams.update_one({"_id": ObjectId(exam_id)}, {"$set": update_data})
    return {"message": "Exam updated successfully"}

@api_router.delete("/admin/exams/{exam_id}")
async def delete_exam(exam_id: str, admin: Dict = Depends(require_admin)):
    result = await db.exams.delete_one({"_id": ObjectId(exam_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Delete associated questions
    await db.questions.delete_many({"exam_id": exam_id})
    return {"message": "Exam deleted successfully"}

# ==================== Question Routes (Admin) ====================

@api_router.post("/admin/questions")
async def create_question(data: QuestionCreate, admin: Dict = Depends(require_admin)):
    # Verify exam exists
    exam = await db.exams.find_one({"_id": ObjectId(data.exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    question = {
        "exam_id": data.exam_id,
        "question_text": data.question_text,
        "question_type": data.question_type,
        "options": [opt.dict() for opt in data.options] if data.options else None,
        "correct_answer": data.correct_answer,
        "marks": data.marks,
        "image_base64": data.image_base64,
        "variants": data.variants,
        "created_at": datetime.utcnow()
    }
    
    result = await db.questions.insert_one(question)
    return {"id": str(result.inserted_id), "message": "Question created successfully"}

@api_router.get("/admin/questions/{exam_id}")
async def list_questions(exam_id: str, admin: Dict = Depends(require_admin)):
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    return [{
        "id": str(q["_id"]),
        "exam_id": q["exam_id"],
        "question_text": q["question_text"],
        "question_type": q["question_type"],
        "options": q.get("options"),
        "correct_answer": q.get("correct_answer"),
        "marks": q["marks"],
        "image_base64": q.get("image_base64")
    } for q in questions]

@api_router.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, admin: Dict = Depends(require_admin)):
    result = await db.questions.delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted successfully"}

# ==================== Student Management (Admin) ====================

@api_router.get("/admin/students")
async def list_students(admin: Dict = Depends(require_admin)):
    students = await db.students.find().to_list(1000)
    return [{
        "id": str(s["_id"]),
        "full_name": s["full_name"],
        "roll_number": s["roll_number"],
        "department": s["department"],
        "semester": s["semester"],
        "created_at": s["created_at"]
    } for s in students]

@api_router.get("/admin/students/{student_id}")
async def get_student(student_id: str, admin: Dict = Depends(require_admin)):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get exam sessions
    sessions = await db.exam_sessions.find({"student_id": student_id}).to_list(100)
    
    return {
        "id": str(student["_id"]),
        "full_name": student["full_name"],
        "roll_number": student["roll_number"],
        "department": student["department"],
        "semester": student["semester"],
        "device_info": student.get("device_info"),
        "created_at": student["created_at"],
        "exam_history": [{
            "id": str(s["_id"]),
            "exam_id": s["exam_id"],
            "status": s["status"],
            "risk_score": s.get("risk_score", 0),
            "marks_obtained": s.get("marks_obtained", 0),
            "start_time": s["start_time"]
        } for s in sessions]
    }

# ==================== Fraud Monitoring (Admin) ====================

@api_router.get("/admin/fraud-alerts")
async def get_fraud_alerts(admin: Dict = Depends(require_admin)):
    # Get sessions with high risk scores or fraud events
    pipeline = [
        {"$match": {"$or": [{"risk_score": {"$gte": 30}}, {"fraud_events": {"$ne": []}}]}},
        {"$sort": {"updated_at": -1}},
        {"$limit": 100}
    ]
    
    sessions = await db.exam_sessions.aggregate(pipeline).to_list(100)
    alerts = []
    
    for session in sessions:
        student = await db.students.find_one({"_id": ObjectId(session["student_id"])})
        exam = await db.exams.find_one({"_id": ObjectId(session["exam_id"])})
        
        if student and exam:
            for event in session.get("fraud_events", []):
                alerts.append({
                    "id": str(session["_id"]),
                    "student_id": session["student_id"],
                    "student_name": student["full_name"],
                    "roll_number": student["roll_number"],
                    "exam_id": session["exam_id"],
                    "exam_title": exam["title"],
                    "fraud_type": event.get("fraud_type"),
                    "details": event.get("details"),
                    "risk_score": session.get("risk_score", 0),
                    "timestamp": event.get("timestamp", session.get("updated_at"))
                })
    
    return alerts

@api_router.get("/admin/live-monitoring")
async def get_live_monitoring(admin: Dict = Depends(require_admin)):
    """Get all active exam sessions for real-time monitoring"""
    active_sessions = await db.exam_sessions.find({"status": "in_progress"}).to_list(500)
    results = []
    
    for session in active_sessions:
        student = await db.students.find_one({"_id": ObjectId(session["student_id"])})
        exam = await db.exams.find_one({"_id": ObjectId(session["exam_id"])})
        
        if student and exam:
            results.append({
                "session_id": str(session["_id"]),
                "student_id": session["student_id"],
                "student_name": student["full_name"],
                "roll_number": student["roll_number"],
                "exam_title": exam["title"],
                "risk_score": session.get("risk_score", 0),
                "fraud_events_count": len(session.get("fraud_events", [])),
                "start_time": session["start_time"],
                "answers_count": len(session.get("answers", []))
            })
    
    return results

@api_router.get("/admin/dashboard-stats")
async def get_dashboard_stats(admin: Dict = Depends(require_admin)):
    """Get dashboard statistics"""
    total_students = await db.students.count_documents({})
    total_exams = await db.exams.count_documents({})
    active_exams = await db.exams.count_documents({"is_active": True})
    total_sessions = await db.exam_sessions.count_documents({})
    active_sessions = await db.exam_sessions.count_documents({"status": "in_progress"})
    high_risk_sessions = await db.exam_sessions.count_documents({"risk_score": {"$gte": 50}})
    
    # Recent fraud alerts
    recent_alerts = await db.exam_sessions.count_documents({
        "risk_score": {"$gte": 30},
        "updated_at": {"$gte": datetime.utcnow() - timedelta(hours=24)}
    })
    
    return {
        "total_students": total_students,
        "total_exams": total_exams,
        "active_exams": active_exams,
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "high_risk_sessions": high_risk_sessions,
        "recent_fraud_alerts": recent_alerts
    }

# ==================== Export Reports (Admin) ====================

@api_router.get("/admin/export/attendance/{exam_id}")
async def export_attendance(exam_id: str, admin: Dict = Depends(require_admin)):
    """Export attendance report for an exam"""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    sessions = await db.exam_sessions.find({"exam_id": exam_id}).to_list(1000)
    report = []
    
    for session in sessions:
        student = await db.students.find_one({"_id": ObjectId(session["student_id"])})
        if student:
            report.append({
                "roll_number": student["roll_number"],
                "full_name": student["full_name"],
                "department": student["department"],
                "semester": student["semester"],
                "status": session["status"],
                "start_time": session["start_time"].isoformat() if session.get("start_time") else None,
                "end_time": session.get("end_time").isoformat() if session.get("end_time") else None
            })
    
    return {
        "exam_title": exam["title"],
        "exam_date": exam["start_time"].isoformat(),
        "total_participants": len(report),
        "attendance": report
    }

@api_router.get("/admin/export/marks/{exam_id}")
async def export_marks(exam_id: str, admin: Dict = Depends(require_admin)):
    """Export marks report for an exam"""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    sessions = await db.exam_sessions.find({"exam_id": exam_id}).to_list(1000)
    report = []
    
    for session in sessions:
        student = await db.students.find_one({"_id": ObjectId(session["student_id"])})
        if student:
            report.append({
                "roll_number": student["roll_number"],
                "full_name": student["full_name"],
                "department": student["department"],
                "marks_obtained": session.get("marks_obtained", 0),
                "total_marks": exam["total_marks"],
                "percentage": round((session.get("marks_obtained", 0) / exam["total_marks"]) * 100, 2) if exam["total_marks"] > 0 else 0,
                "risk_score": session.get("risk_score", 0),
                "status": session["status"]
            })
    
    return {
        "exam_title": exam["title"],
        "total_marks": exam["total_marks"],
        "total_participants": len(report),
        "results": report
    }

@api_router.get("/admin/export/fraud-logs/{exam_id}")
async def export_fraud_logs(exam_id: str, admin: Dict = Depends(require_admin)):
    """Export fraud logs for an exam"""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    sessions = await db.exam_sessions.find({
        "exam_id": exam_id,
        "fraud_events": {"$ne": []}
    }).to_list(1000)
    
    report = []
    for session in sessions:
        student = await db.students.find_one({"_id": ObjectId(session["student_id"])})
        if student:
            for event in session.get("fraud_events", []):
                report.append({
                    "roll_number": student["roll_number"],
                    "full_name": student["full_name"],
                    "fraud_type": event.get("fraud_type"),
                    "details": event.get("details"),
                    "timestamp": event.get("timestamp").isoformat() if event.get("timestamp") else None,
                    "risk_score_at_time": session.get("risk_score", 0)
                })
    
    return {
        "exam_title": exam["title"],
        "total_fraud_events": len(report),
        "fraud_logs": report
    }

# ==================== Student Exam Routes ====================

@api_router.get("/student/exams")
async def get_available_exams(student: Dict = Depends(require_student)):
    """Get exams available for the student"""
    now = datetime.utcnow()
    
    exams = await db.exams.find({
        "department": student["department"],
        "semester": student["semester"],
        "is_active": True,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }).to_list(100)
    
    results = []
    for exam in exams:
        # Check if student already attempted
        existing_session = await db.exam_sessions.find_one({
            "student_id": student["id"],
            "exam_id": str(exam["_id"])
        })
        
        results.append({
            "id": str(exam["_id"]),
            "title": exam["title"],
            "description": exam["description"],
            "duration_minutes": exam["duration_minutes"],
            "total_marks": exam["total_marks"],
            "start_time": exam["start_time"],
            "end_time": exam["end_time"],
            "attempted": existing_session is not None,
            "session_status": existing_session.get("status") if existing_session else None
        })
    
    return results

@api_router.post("/student/exams/{exam_id}/start")
async def start_exam(exam_id: str, student: Dict = Depends(require_student)):
    """Start an exam session"""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check if already attempted
    existing_session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id
    })
    
    if existing_session:
        if existing_session["status"] == "completed":
            raise HTTPException(status_code=400, detail="You have already completed this exam")
        if existing_session["status"] == "in_progress":
            # Return existing session
            questions = await get_randomized_questions(exam_id, student["id"])
            return {
                "session_id": str(existing_session["_id"]),
                "exam": {
                    "id": exam_id,
                    "title": exam["title"],
                    "duration_minutes": exam["duration_minutes"],
                    "total_marks": exam["total_marks"]
                },
                "questions": questions,
                "start_time": existing_session["start_time"],
                "existing_answers": existing_session.get("answers", [])
            }
    
    # Create new session
    session = {
        "student_id": student["id"],
        "exam_id": exam_id,
        "start_time": datetime.utcnow(),
        "end_time": None,
        "status": "in_progress",
        "risk_score": 0,
        "fraud_events": [],
        "answers": [],
        "marks_obtained": 0,
        "question_order": [],  # Store randomized order
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.exam_sessions.insert_one(session)
    session_id = str(result.inserted_id)
    
    # Get randomized questions
    questions = await get_randomized_questions(exam_id, student["id"])
    
    # Store question order
    await db.exam_sessions.update_one(
        {"_id": result.inserted_id},
        {"$set": {"question_order": [q["id"] for q in questions]}}
    )
    
    return {
        "session_id": session_id,
        "exam": {
            "id": exam_id,
            "title": exam["title"],
            "duration_minutes": exam["duration_minutes"],
            "total_marks": exam["total_marks"]
        },
        "questions": questions,
        "start_time": session["start_time"],
        "existing_answers": []
    }

async def get_randomized_questions(exam_id: str, student_id: str):
    """Get questions with randomized order and options"""
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    
    # Randomize question order using student_id as seed for consistency
    seed = hash(student_id + exam_id) % (2**32)
    random.seed(seed)
    random.shuffle(questions)
    
    result = []
    for q in questions:
        question_data = {
            "id": str(q["_id"]),
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "marks": q["marks"],
            "image_base64": q.get("image_base64")
        }
        
        if q["question_type"] == "mcq" and q.get("options"):
            # Randomize option order
            options = q["options"].copy()
            random.shuffle(options)
            # Remove is_correct from options sent to student
            question_data["options"] = [{
                "id": opt["id"],
                "text": opt["text"]
            } for opt in options]
        
        result.append(question_data)
    
    return result

@api_router.post("/student/exams/{exam_id}/answer")
async def submit_answer(exam_id: str, data: AnswerSubmit, student: Dict = Depends(require_student)):
    """Submit a single answer during exam"""
    session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id,
        "status": "in_progress"
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="No active exam session found")
    
    # Check if answer already exists for this question
    existing_answers = session.get("answers", [])
    answer_exists = any(a["question_id"] == data.question_id for a in existing_answers)
    
    answer_data = {
        "question_id": data.question_id,
        "answer": data.answer,
        "time_taken_seconds": data.time_taken_seconds,
        "submitted_at": datetime.utcnow()
    }
    
    if answer_exists:
        # Update existing answer
        await db.exam_sessions.update_one(
            {"_id": session["_id"], "answers.question_id": data.question_id},
            {"$set": {"answers.$": answer_data, "updated_at": datetime.utcnow()}}
        )
    else:
        # Add new answer
        await db.exam_sessions.update_one(
            {"_id": session["_id"]},
            {"$push": {"answers": answer_data}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    return {"message": "Answer saved successfully"}

@api_router.post("/student/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, student: Dict = Depends(require_student)):
    """Submit the entire exam"""
    session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id,
        "status": "in_progress"
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="No active exam session found")
    
    # Calculate marks
    marks_obtained = await calculate_marks(exam_id, session.get("answers", []))
    
    # Update session
    await db.exam_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "completed",
            "end_time": datetime.utcnow(),
            "marks_obtained": marks_obtained,
            "updated_at": datetime.utcnow()
        }}
    )
    
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    
    return {
        "message": "Exam submitted successfully",
        "marks_obtained": marks_obtained,
        "total_marks": exam["total_marks"] if exam else 0,
        "risk_score": session.get("risk_score", 0)
    }

async def calculate_marks(exam_id: str, answers: List[Dict]) -> int:
    """Calculate marks for submitted answers"""
    total_marks = 0
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    question_map = {str(q["_id"]): q for q in questions}
    
    for answer in answers:
        question = question_map.get(answer["question_id"])
        if not question:
            continue
        
        if question["question_type"] == "mcq":
            # Find correct option
            correct_option = None
            for opt in question.get("options", []):
                if opt.get("is_correct"):
                    correct_option = opt["id"]
                    break
            
            if answer["answer"] == correct_option:
                total_marks += question["marks"]
        
        elif question["question_type"] == "short_answer":
            # For short answers, we'll mark them as correct if they match
            # In production, this would need manual grading or AI evaluation
            if question.get("correct_answer"):
                if answer["answer"].strip().lower() == question["correct_answer"].strip().lower():
                    total_marks += question["marks"]
    
    return total_marks

# ==================== Fraud Detection Routes ====================

@api_router.post("/student/fraud-event")
async def log_fraud_event(data: FraudLogCreate, student: Dict = Depends(require_student)):
    """Log a fraud event during exam (called silently from frontend)"""
    session = await db.exam_sessions.find_one({"_id": ObjectId(data.exam_session_id)})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["student_id"] != student["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    fraud_event = {
        "fraud_type": data.fraud_type,
        "details": data.details,
        "timestamp": datetime.utcnow()
    }
    
    new_risk_score = min(100, session.get("risk_score", 0) + data.risk_score_delta)
    
    await db.exam_sessions.update_one(
        {"_id": session["_id"]},
        {
            "$push": {"fraud_events": fraud_event},
            "$set": {"risk_score": new_risk_score, "updated_at": datetime.utcnow()}
        }
    )
    
    # If risk score exceeds threshold, auto-submit exam
    if new_risk_score >= 80:
        await db.exam_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {
                "status": "auto_submitted",
                "end_time": datetime.utcnow()
            }}
        )
    
    return {"message": "Event logged", "risk_score": new_risk_score}

# AI-based fraud analysis endpoint
@api_router.post("/admin/analyze-answer")
async def analyze_answer_for_fraud(
    data: Dict[str, Any],
    admin: Dict = Depends(require_admin)
):
    """Use AI to analyze an answer for fraud patterns"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"error": "AI analysis not configured", "is_suspicious": False}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"fraud-analysis-{uuid.uuid4()}",
            system_message="""You are a fraud detection AI for an examination system. 
            Analyze the given answer and determine if it shows signs of:
            1. AI-generated content (overly structured, perfect grammar, generic responses)
            2. Copy-pasted content (unusual formatting, inconsistent style)
            3. Inappropriate content for an exam answer
            
            Respond with a JSON object containing:
            - is_suspicious: boolean
            - confidence: number 0-100
            - reasons: array of strings explaining suspicions
            """
        ).with_model("openai", "gpt-5.2")
        
        answer_text = data.get("answer_text", "")
        question_text = data.get("question_text", "")
        
        message = UserMessage(
            text=f"Question: {question_text}\n\nStudent's Answer: {answer_text}\n\nAnalyze this answer for potential fraud."
        )
        
        response = await chat.send_message(message)
        
        # Parse the response
        import json
        try:
            result = json.loads(response)
        except:
            result = {"is_suspicious": False, "confidence": 0, "reasons": []}
        
        return result
        
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        return {"error": str(e), "is_suspicious": False}

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "College Examination API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
