from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
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
import base64
import io
import re
import json

# Document parsing imports
from docx import Document
from docx.shared import Inches
import mammoth

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
app = FastAPI(title="Geography PUC Test Center API", version="2.0.0")

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

class SubQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str  # e.g., "a", "b", "c"
    text: str
    marks: int = 1

class QuestionCreate(BaseModel):
    exam_id: str
    question_text: str
    question_type: str  # "mcq", "short_answer", "long_answer", "sub_questions"
    options: Optional[List[QuestionOption]] = None
    correct_answer: Optional[str] = None
    marks: int = 1
    image_base64: Optional[str] = None
    variants: Optional[List[Dict[str, Any]]] = None
    sub_questions: Optional[List[SubQuestion]] = None
    formula_latex: Optional[str] = None  # LaTeX formula support
    table_data: Optional[Dict[str, Any]] = None  # Table support

class QuestionResponse(BaseModel):
    id: str
    exam_id: str
    question_text: str
    question_type: str
    options: Optional[List[Dict[str, Any]]] = None
    marks: int
    image_base64: Optional[str] = None
    formula_latex: Optional[str] = None
    sub_questions: Optional[List[Dict[str, Any]]] = None

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
    preview_validated: bool = False

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
    preview_validated: bool = False

# Enhanced Fraud/Integrity Models
class DetailedFraudEvent(BaseModel):
    fraud_type: str
    details: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    risk_delta: int = 0
    metadata: Optional[Dict[str, Any]] = None

class CameraCheckLog(BaseModel):
    check_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    face_detected: bool = False
    multiple_faces: bool = False
    face_confidence: float = 0.0
    notes: Optional[str] = None

class StudentIntegrityReport(BaseModel):
    student_id: str
    exam_id: str
    total_duration_seconds: int
    question_time_breakdown: List[Dict[str, Any]]
    app_focus_loss_count: int
    device_change_attempts: int
    bluetooth_activity_detected: bool
    hotspot_activity_detected: bool
    ai_generated_probability: float
    answer_similarity_index: float
    orientation_change_count: int
    fraud_risk_score: int
    risk_level: str  # LOW, MODERATE, HIGH
    fraud_timeline: List[Dict[str, Any]]
    camera_check_logs: List[Dict[str, Any]]
    ai_reasoning_summary: str

class AnswerSubmit(BaseModel):
    question_id: str
    answer: str
    time_taken_seconds: int

class ExamSubmission(BaseModel):
    exam_id: str
    answers: List[AnswerSubmit]

class FraudLogCreate(BaseModel):
    exam_session_id: str
    fraud_type: str
    details: str
    risk_score_delta: int
    metadata: Optional[Dict[str, Any]] = None

# Document Upload Models
class ParsedQuestion(BaseModel):
    question_number: int
    question_text: str
    question_type: str
    options: Optional[List[Dict[str, str]]] = None
    correct_answer: Optional[str] = None
    sub_questions: Optional[List[Dict[str, Any]]] = None
    marks: int = 1
    image_base64: Optional[str] = None
    formula_latex: Optional[str] = None
    parse_warnings: List[str] = []
    parse_errors: List[str] = []

class DocumentParseResult(BaseModel):
    success: bool
    questions: List[ParsedQuestion]
    total_questions: int
    warnings: List[str]
    errors: List[str]
    images_extracted: int

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
    parts = [
        str(device_info.get("device_id", "")),
        str(device_info.get("os", "")),
        str(device_info.get("os_version", "")),
        str(device_info.get("screen_width", "")),
        str(device_info.get("screen_height", ""))
    ]
    return "-".join(parts)

# ==================== Document Parsing Functions ====================

def parse_word_document(file_content: bytes) -> DocumentParseResult:
    """Parse a Word document and extract questions with enhanced detection"""
    questions = []
    warnings = []
    errors = []
    images_extracted = 0
    
    try:
        doc = Document(io.BytesIO(file_content))
        
        current_question = None
        question_number = 0
        current_options = []
        current_sub_questions = []
        
        # Pattern matching for questions
        question_pattern = re.compile(r'^(?:Q\.?\s*)?(\d+)[\.\)]\s*(.+)', re.IGNORECASE)
        option_pattern = re.compile(r'^([A-Da-d])[\.\)]\s*(.+)')
        sub_question_pattern = re.compile(r'^([a-z])[\.\)]\s*(.+)', re.IGNORECASE)
        marks_pattern = re.compile(r'\[(\d+)\s*(?:marks?|pts?|points?)?\]', re.IGNORECASE)
        
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            
            # Check for LaTeX formulas (between $ or \[ \])
            formula_match = re.search(r'\$(.+?)\$|\\\[(.+?)\\\]', text)
            formula_latex = None
            if formula_match:
                formula_latex = formula_match.group(1) or formula_match.group(2)
            
            # Extract marks if specified
            marks_match = marks_pattern.search(text)
            marks = int(marks_match.group(1)) if marks_match else 1
            if marks_match:
                text = marks_pattern.sub('', text).strip()
            
            # Check for question pattern
            q_match = question_pattern.match(text)
            if q_match:
                # Save previous question
                if current_question:
                    q_type = "mcq" if current_options else ("sub_questions" if current_sub_questions else "short_answer")
                    questions.append(ParsedQuestion(
                        question_number=question_number,
                        question_text=current_question,
                        question_type=q_type,
                        options=[{"id": str(i), "text": opt, "is_correct": i == 0} for i, opt in enumerate(current_options)] if current_options else None,
                        sub_questions=current_sub_questions if current_sub_questions else None,
                        marks=marks,
                        formula_latex=formula_latex,
                        parse_warnings=[],
                        parse_errors=[]
                    ))
                
                question_number = int(q_match.group(1))
                current_question = q_match.group(2).strip()
                current_options = []
                current_sub_questions = []
                continue
            
            # Check for option pattern
            opt_match = option_pattern.match(text)
            if opt_match and current_question:
                current_options.append(opt_match.group(2).strip())
                continue
            
            # Check for sub-question pattern
            sub_match = sub_question_pattern.match(text)
            if sub_match and current_question and not current_options:
                current_sub_questions.append({
                    "label": sub_match.group(1),
                    "text": sub_match.group(2).strip(),
                    "marks": 1
                })
                continue
            
            # Append to current question if exists
            if current_question:
                current_question += " " + text
        
        # Save last question
        if current_question:
            q_type = "mcq" if current_options else ("sub_questions" if current_sub_questions else "short_answer")
            questions.append(ParsedQuestion(
                question_number=question_number,
                question_text=current_question,
                question_type=q_type,
                options=[{"id": str(i), "text": opt, "is_correct": i == 0} for i, opt in enumerate(current_options)] if current_options else None,
                sub_questions=current_sub_questions if current_sub_questions else None,
                marks=1,
                parse_warnings=[],
                parse_errors=[]
            ))
        
        # Extract images from document
        for rel in doc.part.rels.values():
            if "image" in rel.target_ref:
                try:
                    image_data = rel.target_part.blob
                    images_extracted += 1
                except Exception as e:
                    warnings.append(f"Could not extract image: {str(e)}")
        
        # Validate questions
        for q in questions:
            if len(q.question_text) < 10:
                q.parse_warnings.append("Question text seems too short")
            if q.question_type == "mcq" and (not q.options or len(q.options) < 2):
                q.parse_errors.append("MCQ must have at least 2 options")
            if q.question_type == "mcq" and q.options and len(q.options) > 6:
                q.parse_warnings.append("MCQ has more than 6 options, consider splitting")
        
        return DocumentParseResult(
            success=len(errors) == 0,
            questions=questions,
            total_questions=len(questions),
            warnings=warnings,
            errors=errors,
            images_extracted=images_extracted
        )
        
    except Exception as e:
        logger.error(f"Document parsing error: {str(e)}")
        return DocumentParseResult(
            success=False,
            questions=[],
            total_questions=0,
            warnings=[],
            errors=[f"Failed to parse document: {str(e)}"],
            images_extracted=0
        )

def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate similarity between two texts using simple approach"""
    if not text1 or not text2:
        return 0.0
    
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    return len(intersection) / len(union) if union else 0.0

async def analyze_ai_generated_probability(text: str) -> float:
    """Analyze if text appears to be AI-generated"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return 0.0
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ai-detection-{uuid.uuid4()}",
            system_message="""You are an AI text detection system. Analyze the given text and determine the probability (0-100) that it was generated by AI.
            Consider:
            - Overly structured responses
            - Perfect grammar in casual contexts
            - Generic phrasing
            - Lack of personal voice
            Respond with ONLY a number between 0 and 100."""
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(text=f"Analyze this exam answer: {text[:500]}")
        response = await chat.send_message(message)
        
        try:
            probability = float(re.search(r'\d+', response).group())
            return min(100, max(0, probability))
        except:
            return 0.0
            
    except Exception as e:
        logger.error(f"AI detection error: {str(e)}")
        return 0.0

def calculate_risk_level(score: int) -> str:
    """Calculate risk level from score"""
    if score >= 70:
        return "HIGH"
    elif score >= 40:
        return "MODERATE"
    return "LOW"

# ==================== Authentication Routes ====================

@api_router.post("/auth/student/register", response_model=TokenResponse)
async def register_student(data: StudentRegister):
    existing = await db.students.find_one({"roll_number": data.roll_number})
    if existing:
        raise HTTPException(status_code=400, detail="Roll number already registered")
    
    device_fingerprint = generate_device_fingerprint(data.device_info)
    
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
    
    device_fingerprint = generate_device_fingerprint(data.device_info)
    
    if student.get("device_fingerprint") and student["device_fingerprint"] != device_fingerprint:
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

# ==================== Document Upload Routes ====================

@api_router.post("/admin/upload-questions")
async def upload_questions_document(
    file: UploadFile = File(...),
    exam_id: str = Form(...),
    admin: Dict = Depends(require_admin)
):
    """Upload and parse a Word document containing questions"""
    
    if not file.filename.endswith(('.doc', '.docx')):
        raise HTTPException(status_code=400, detail="Only .doc and .docx files are supported")
    
    # Verify exam exists
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    try:
        content = await file.read()
        parse_result = parse_word_document(content)
        
        # Store parsed questions for preview
        upload_record = {
            "exam_id": exam_id,
            "filename": file.filename,
            "uploaded_by": admin["id"],
            "uploaded_at": datetime.utcnow(),
            "parse_result": {
                "success": parse_result.success,
                "total_questions": parse_result.total_questions,
                "warnings": parse_result.warnings,
                "errors": parse_result.errors,
                "images_extracted": parse_result.images_extracted,
                "questions": [q.dict() for q in parse_result.questions]
            },
            "status": "pending_review"
        }
        
        result = await db.question_uploads.insert_one(upload_record)
        
        return {
            "upload_id": str(result.inserted_id),
            "success": parse_result.success,
            "total_questions": parse_result.total_questions,
            "warnings": parse_result.warnings,
            "errors": parse_result.errors,
            "images_extracted": parse_result.images_extracted,
            "questions_preview": [q.dict() for q in parse_result.questions[:5]],  # Preview first 5
            "message": "Document parsed successfully. Review and confirm to add questions."
        }
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@api_router.post("/admin/confirm-upload/{upload_id}")
async def confirm_question_upload(
    upload_id: str,
    corrections: Optional[Dict[str, Any]] = None,
    admin: Dict = Depends(require_admin)
):
    """Confirm and add parsed questions to exam"""
    
    upload = await db.question_uploads.find_one({"_id": ObjectId(upload_id)})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if upload["status"] != "pending_review":
        raise HTTPException(status_code=400, detail="Upload already processed")
    
    questions_added = 0
    errors = []
    
    for q_data in upload["parse_result"]["questions"]:
        try:
            # Apply any corrections
            if corrections and str(q_data["question_number"]) in corrections:
                q_data.update(corrections[str(q_data["question_number"])])
            
            question = {
                "exam_id": upload["exam_id"],
                "question_text": q_data["question_text"],
                "question_type": q_data["question_type"],
                "options": q_data.get("options"),
                "correct_answer": q_data.get("correct_answer"),
                "marks": q_data.get("marks", 1),
                "image_base64": q_data.get("image_base64"),
                "formula_latex": q_data.get("formula_latex"),
                "sub_questions": q_data.get("sub_questions"),
                "created_at": datetime.utcnow()
            }
            
            await db.questions.insert_one(question)
            questions_added += 1
            
        except Exception as e:
            errors.append(f"Question {q_data['question_number']}: {str(e)}")
    
    # Update upload status
    await db.question_uploads.update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"status": "confirmed", "questions_added": questions_added}}
    )
    
    return {
        "success": True,
        "questions_added": questions_added,
        "errors": errors
    }

@api_router.get("/admin/upload-preview/{upload_id}")
async def get_upload_preview(upload_id: str, admin: Dict = Depends(require_admin)):
    """Get full preview of uploaded questions"""
    
    upload = await db.question_uploads.find_one({"_id": ObjectId(upload_id)})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return {
        "upload_id": upload_id,
        "exam_id": upload["exam_id"],
        "filename": upload["filename"],
        "uploaded_at": upload["uploaded_at"],
        "status": upload["status"],
        "parse_result": upload["parse_result"]
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
        "preview_validated": False,
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
        created_at=exam["created_at"],
        preview_validated=False
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
            created_at=exam["created_at"],
            preview_validated=exam.get("preview_validated", False)
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
        "preview_validated": exam.get("preview_validated", False),
        "question_count": question_count,
        "created_at": exam["created_at"],
        "questions": [{
            "id": str(q["_id"]),
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "marks": q["marks"],
            "image_base64": q.get("image_base64"),
            "formula_latex": q.get("formula_latex"),
            "sub_questions": q.get("sub_questions")
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
    
    await db.questions.delete_many({"exam_id": exam_id})
    return {"message": "Exam deleted successfully"}

# ==================== Preview Validation Routes ====================

@api_router.post("/admin/exams/{exam_id}/validate-preview")
async def validate_exam_preview(exam_id: str, admin: Dict = Depends(require_admin)):
    """Validate exam preview and check for issues"""
    
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    
    validation_errors = []
    validation_warnings = []
    
    if len(questions) == 0:
        validation_errors.append("Exam has no questions")
    
    total_marks = 0
    for i, q in enumerate(questions):
        total_marks += q.get("marks", 1)
        
        # Check question text
        if len(q.get("question_text", "")) < 10:
            validation_warnings.append(f"Question {i+1}: Text seems too short")
        
        # Check MCQ options
        if q.get("question_type") == "mcq":
            options = q.get("options", [])
            if len(options) < 2:
                validation_errors.append(f"Question {i+1}: MCQ needs at least 2 options")
            if not any(opt.get("is_correct") for opt in options):
                validation_errors.append(f"Question {i+1}: No correct answer marked")
        
        # Check image validity
        if q.get("image_base64"):
            try:
                base64.b64decode(q["image_base64"])
            except:
                validation_errors.append(f"Question {i+1}: Invalid image data")
        
        # Check LaTeX formula
        if q.get("formula_latex"):
            # Basic LaTeX validation
            formula = q["formula_latex"]
            if formula.count("{") != formula.count("}"):
                validation_warnings.append(f"Question {i+1}: Formula may have unbalanced braces")
    
    # Check total marks
    if total_marks != exam.get("total_marks"):
        validation_warnings.append(f"Question marks ({total_marks}) don't match exam total ({exam.get('total_marks')})")
    
    # Update validation status if no errors
    if len(validation_errors) == 0:
        await db.exams.update_one(
            {"_id": ObjectId(exam_id)},
            {"$set": {"preview_validated": True, "validation_date": datetime.utcnow()}}
        )
    
    return {
        "valid": len(validation_errors) == 0,
        "can_publish": len(validation_errors) == 0,
        "errors": validation_errors,
        "warnings": validation_warnings,
        "total_questions": len(questions),
        "total_marks_calculated": total_marks,
        "exam_total_marks": exam.get("total_marks")
    }

@api_router.get("/admin/exams/{exam_id}/preview")
async def get_exam_preview(
    exam_id: str,
    view_mode: str = "phone",  # phone, tablet
    test_randomization: bool = False,
    admin: Dict = Depends(require_admin)
):
    """Get exam preview for different device views"""
    
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    
    # Apply randomization if requested
    if test_randomization:
        random.seed(datetime.utcnow().timestamp())
        random.shuffle(questions)
        for q in questions:
            if q.get("options"):
                random.shuffle(q["options"])
    
    # Format questions for preview
    preview_questions = []
    for q in questions:
        preview_q = {
            "id": str(q["_id"]),
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "marks": q.get("marks", 1),
            "options": q.get("options"),
            "sub_questions": q.get("sub_questions"),
            "image_base64": q.get("image_base64"),
            "formula_latex": q.get("formula_latex"),
            "has_image": bool(q.get("image_base64")),
            "has_formula": bool(q.get("formula_latex"))
        }
        preview_questions.append(preview_q)
    
    return {
        "exam_id": exam_id,
        "title": exam["title"],
        "duration_minutes": exam["duration_minutes"],
        "total_marks": exam["total_marks"],
        "view_mode": view_mode,
        "preview_validated": exam.get("preview_validated", False),
        "questions": preview_questions,
        "total_questions": len(preview_questions)
    }

@api_router.post("/admin/exams/{exam_id}/publish")
async def publish_exam(exam_id: str, admin: Dict = Depends(require_admin)):
    """Publish exam (only if preview validated)"""
    
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if not exam.get("preview_validated"):
        raise HTTPException(
            status_code=400, 
            detail="Cannot publish exam: Preview validation required. Please validate preview first."
        )
    
    await db.exams.update_one(
        {"_id": ObjectId(exam_id)},
        {"$set": {"is_active": True, "published_at": datetime.utcnow()}}
    )
    
    return {"message": "Exam published successfully", "is_active": True}

# ==================== Question Routes (Admin) ====================

@api_router.post("/admin/questions")
async def create_question(data: QuestionCreate, admin: Dict = Depends(require_admin)):
    exam = await db.exams.find_one({"_id": ObjectId(data.exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Invalidate preview when adding questions
    await db.exams.update_one(
        {"_id": ObjectId(data.exam_id)},
        {"$set": {"preview_validated": False}}
    )
    
    question = {
        "exam_id": data.exam_id,
        "question_text": data.question_text,
        "question_type": data.question_type,
        "options": [opt.dict() for opt in data.options] if data.options else None,
        "correct_answer": data.correct_answer,
        "marks": data.marks,
        "image_base64": data.image_base64,
        "formula_latex": data.formula_latex,
        "sub_questions": [sq.dict() for sq in data.sub_questions] if data.sub_questions else None,
        "table_data": data.table_data,
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
        "image_base64": q.get("image_base64"),
        "formula_latex": q.get("formula_latex"),
        "sub_questions": q.get("sub_questions")
    } for q in questions]

@api_router.put("/admin/questions/{question_id}")
async def update_question(question_id: str, data: QuestionCreate, admin: Dict = Depends(require_admin)):
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Invalidate preview
    await db.exams.update_one(
        {"_id": ObjectId(question["exam_id"])},
        {"$set": {"preview_validated": False}}
    )
    
    update_data = {
        "question_text": data.question_text,
        "question_type": data.question_type,
        "options": [opt.dict() for opt in data.options] if data.options else None,
        "correct_answer": data.correct_answer,
        "marks": data.marks,
        "image_base64": data.image_base64,
        "formula_latex": data.formula_latex,
        "sub_questions": [sq.dict() for sq in data.sub_questions] if data.sub_questions else None,
        "updated_at": datetime.utcnow()
    }
    
    await db.questions.update_one({"_id": ObjectId(question_id)}, {"$set": update_data})
    return {"message": "Question updated successfully"}

@api_router.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, admin: Dict = Depends(require_admin)):
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if question:
        await db.exams.update_one(
            {"_id": ObjectId(question["exam_id"])},
            {"$set": {"preview_validated": False}}
        )
    
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

# ==================== Enhanced Integrity Report Routes ====================

@api_router.get("/admin/students/{student_id}/integrity-report/{session_id}")
async def get_student_integrity_report(
    student_id: str,
    session_id: str,
    admin: Dict = Depends(require_admin)
):
    """Generate detailed integrity report for a student's exam session"""
    
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    session = await db.exam_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    exam = await db.exams.find_one({"_id": ObjectId(session["exam_id"])})
    
    # Calculate metrics
    fraud_events = session.get("fraud_events", [])
    answers = session.get("answers", [])
    
    # Time analysis
    total_duration = 0
    if session.get("end_time") and session.get("start_time"):
        total_duration = int((session["end_time"] - session["start_time"]).total_seconds())
    
    question_time_breakdown = []
    for ans in answers:
        question_time_breakdown.append({
            "question_id": ans["question_id"],
            "time_spent_seconds": ans.get("time_taken_seconds", 0),
            "submitted_at": ans.get("submitted_at")
        })
    
    # Count fraud events by type
    app_focus_loss = sum(1 for e in fraud_events if e.get("fraud_type") in ["app_backgrounded", "window_blur"])
    device_changes = sum(1 for e in fraud_events if e.get("fraud_type") == "device_change_attempt")
    bluetooth_activity = any(e.get("fraud_type") == "bluetooth_detected" for e in fraud_events)
    hotspot_activity = any(e.get("fraud_type") == "hotspot_detected" for e in fraud_events)
    orientation_changes = sum(1 for e in fraud_events if e.get("fraud_type") == "orientation_change")
    
    # Calculate AI probability for answers (sample)
    ai_probability = 0.0
    if answers:
        long_answers = [a for a in answers if len(a.get("answer", "")) > 50]
        if long_answers:
            sample_text = " ".join([a["answer"] for a in long_answers[:3]])
            ai_probability = await analyze_ai_generated_probability(sample_text)
    
    # Calculate answer similarity with other students
    similarity_index = 0.0
    other_sessions = await db.exam_sessions.find({
        "exam_id": session["exam_id"],
        "_id": {"$ne": ObjectId(session_id)}
    }).to_list(100)
    
    if other_sessions and answers:
        similarities = []
        for other in other_sessions:
            other_answers = other.get("answers", [])
            for ans in answers:
                matching = [oa for oa in other_answers if oa.get("question_id") == ans.get("question_id")]
                if matching:
                    sim = calculate_text_similarity(ans.get("answer", ""), matching[0].get("answer", ""))
                    if sim > 0.7:  # Only count high similarity
                        similarities.append(sim)
        if similarities:
            similarity_index = sum(similarities) / len(similarities) * 100
    
    # Get camera check logs
    camera_logs = session.get("camera_check_logs", [])
    
    # Build fraud timeline
    fraud_timeline = []
    for event in sorted(fraud_events, key=lambda x: x.get("timestamp", datetime.min)):
        fraud_timeline.append({
            "timestamp": event.get("timestamp"),
            "type": event.get("fraud_type"),
            "details": event.get("details"),
            "risk_delta": event.get("risk_delta", 0)
        })
    
    risk_score = session.get("risk_score", 0)
    risk_level = calculate_risk_level(risk_score)
    
    # Generate AI reasoning summary
    ai_summary = f"""
    Student {student['full_name']} ({student['roll_number']}) completed the exam with a risk score of {risk_score}/100 ({risk_level} RISK).
    
    Key Observations:
    - App focus lost {app_focus_loss} times during exam
    - {len(fraud_events)} total suspicious events detected
    - AI-generated content probability: {ai_probability:.1f}%
    - Answer similarity with peers: {similarity_index:.1f}%
    
    {"⚠️ HIGH RISK: This student shows significant indicators of potential unfair means." if risk_level == "HIGH" else ""}
    {"⚡ MODERATE RISK: Some suspicious activity detected, manual review recommended." if risk_level == "MODERATE" else ""}
    {"✅ LOW RISK: No significant concerns detected." if risk_level == "LOW" else ""}
    """
    
    report = {
        "student_id": student_id,
        "student_name": student["full_name"],
        "roll_number": student["roll_number"],
        "exam_id": session["exam_id"],
        "exam_title": exam["title"] if exam else "Unknown",
        "session_id": session_id,
        "total_duration_seconds": total_duration,
        "question_time_breakdown": question_time_breakdown,
        "app_focus_loss_count": app_focus_loss,
        "device_change_attempts": device_changes,
        "bluetooth_activity_detected": bluetooth_activity,
        "hotspot_activity_detected": hotspot_activity,
        "ai_generated_probability": ai_probability,
        "answer_similarity_index": similarity_index,
        "orientation_change_count": orientation_changes,
        "fraud_risk_score": risk_score,
        "risk_level": risk_level,
        "fraud_timeline": fraud_timeline,
        "camera_check_logs": camera_logs,
        "ai_reasoning_summary": ai_summary.strip(),
        "generated_at": datetime.utcnow().isoformat(),
        "suitable_for": ["Department review", "Examination committee", "Disciplinary proceedings"]
    }
    
    # Store report for records
    await db.integrity_reports.update_one(
        {"session_id": session_id},
        {"$set": report},
        upsert=True
    )
    
    return report

@api_router.get("/admin/integrity-reports")
async def list_integrity_reports(
    exam_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    admin: Dict = Depends(require_admin)
):
    """List all integrity reports with filtering"""
    
    query = {}
    if exam_id:
        query["exam_id"] = exam_id
    if risk_level:
        query["risk_level"] = risk_level.upper()
    
    reports = await db.integrity_reports.find(query).sort("fraud_risk_score", -1).to_list(500)
    
    return [{
        "session_id": r["session_id"],
        "student_name": r.get("student_name"),
        "roll_number": r.get("roll_number"),
        "exam_title": r.get("exam_title"),
        "risk_score": r.get("fraud_risk_score", 0),
        "risk_level": r.get("risk_level"),
        "generated_at": r.get("generated_at")
    } for r in reports]

# ==================== Camera Monitoring Routes ====================

@api_router.post("/admin/camera-check/{session_id}")
async def request_camera_check(
    session_id: str,
    admin: Dict = Depends(require_admin)
):
    """Request a camera check for an active exam session"""
    
    session = await db.exam_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Create camera check request
    check_request = {
        "session_id": session_id,
        "requested_by": admin["id"],
        "requested_at": datetime.utcnow(),
        "status": "pending",
        "check_id": str(uuid.uuid4())
    }
    
    await db.camera_check_requests.insert_one(check_request)
    
    return {
        "check_id": check_request["check_id"],
        "message": "Camera check requested",
        "status": "pending"
    }

@api_router.post("/student/camera-check-response")
async def submit_camera_check(
    check_id: str = Form(...),
    face_detected: bool = Form(...),
    multiple_faces: bool = Form(False),
    face_confidence: float = Form(0.0),
    image_base64: Optional[str] = Form(None),
    student: Dict = Depends(require_student)
):
    """Submit camera check response from student device"""
    
    check_request = await db.camera_check_requests.find_one({"check_id": check_id})
    if not check_request:
        raise HTTPException(status_code=404, detail="Check request not found")
    
    # Update check request
    await db.camera_check_requests.update_one(
        {"check_id": check_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "face_detected": face_detected,
            "multiple_faces": multiple_faces,
            "face_confidence": face_confidence
        }}
    )
    
    # Add to session camera logs
    camera_log = {
        "check_id": check_id,
        "timestamp": datetime.utcnow(),
        "face_detected": face_detected,
        "multiple_faces": multiple_faces,
        "face_confidence": face_confidence
    }
    
    await db.exam_sessions.update_one(
        {"_id": ObjectId(check_request["session_id"])},
        {"$push": {"camera_check_logs": camera_log}}
    )
    
    # If multiple faces detected, log fraud event
    if multiple_faces:
        await db.exam_sessions.update_one(
            {"_id": ObjectId(check_request["session_id"])},
            {
                "$push": {
                    "fraud_events": {
                        "fraud_type": "multiple_faces_detected",
                        "details": f"Multiple faces detected during camera check (confidence: {face_confidence})",
                        "timestamp": datetime.utcnow()
                    }
                },
                "$inc": {"risk_score": 30}
            }
        )
    
    return {"message": "Camera check submitted", "check_id": check_id}

@api_router.get("/student/pending-camera-checks")
async def get_pending_camera_checks(student: Dict = Depends(require_student)):
    """Get pending camera check requests for student"""
    
    # Find active session
    session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "status": "in_progress"
    })
    
    if not session:
        return {"checks": []}
    
    pending = await db.camera_check_requests.find({
        "session_id": str(session["_id"]),
        "status": "pending"
    }).to_list(10)
    
    return {
        "checks": [{
            "check_id": c["check_id"],
            "requested_at": c["requested_at"]
        } for c in pending]
    }

# ==================== Fraud Monitoring (Admin) ====================

@api_router.get("/admin/fraud-alerts")
async def get_fraud_alerts(admin: Dict = Depends(require_admin)):
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
                "risk_level": calculate_risk_level(session.get("risk_score", 0)),
                "fraud_events_count": len(session.get("fraud_events", [])),
                "start_time": session["start_time"],
                "answers_count": len(session.get("answers", [])),
                "camera_checks_pending": await db.camera_check_requests.count_documents({
                    "session_id": str(session["_id"]),
                    "status": "pending"
                })
            })
    
    return results

@api_router.get("/admin/dashboard-stats")
async def get_dashboard_stats(admin: Dict = Depends(require_admin)):
    total_students = await db.students.count_documents({})
    total_exams = await db.exams.count_documents({})
    active_exams = await db.exams.count_documents({"is_active": True})
    total_sessions = await db.exam_sessions.count_documents({})
    active_sessions = await db.exam_sessions.count_documents({"status": "in_progress"})
    high_risk_sessions = await db.exam_sessions.count_documents({"risk_score": {"$gte": 50}})
    
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
                "risk_level": calculate_risk_level(session.get("risk_score", 0)),
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
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    existing_session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id
    })
    
    if existing_session:
        if existing_session["status"] == "completed":
            raise HTTPException(status_code=400, detail="You have already completed this exam")
        if existing_session["status"] == "in_progress":
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
        "question_order": [],
        "camera_check_logs": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.exam_sessions.insert_one(session)
    session_id = str(result.inserted_id)
    
    questions = await get_randomized_questions(exam_id, student["id"])
    
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
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    
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
            "image_base64": q.get("image_base64"),
            "formula_latex": q.get("formula_latex"),
            "sub_questions": q.get("sub_questions")
        }
        
        if q["question_type"] == "mcq" and q.get("options"):
            options = q["options"].copy()
            random.shuffle(options)
            question_data["options"] = [{
                "id": opt["id"],
                "text": opt["text"]
            } for opt in options]
        
        result.append(question_data)
    
    return result

@api_router.post("/student/exams/{exam_id}/answer")
async def submit_answer(exam_id: str, data: AnswerSubmit, student: Dict = Depends(require_student)):
    session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id,
        "status": "in_progress"
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="No active exam session found")
    
    existing_answers = session.get("answers", [])
    answer_exists = any(a["question_id"] == data.question_id for a in existing_answers)
    
    answer_data = {
        "question_id": data.question_id,
        "answer": data.answer,
        "time_taken_seconds": data.time_taken_seconds,
        "submitted_at": datetime.utcnow()
    }
    
    if answer_exists:
        await db.exam_sessions.update_one(
            {"_id": session["_id"], "answers.question_id": data.question_id},
            {"$set": {"answers.$": answer_data, "updated_at": datetime.utcnow()}}
        )
    else:
        await db.exam_sessions.update_one(
            {"_id": session["_id"]},
            {"$push": {"answers": answer_data}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    return {"message": "Answer saved successfully"}

@api_router.post("/student/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, student: Dict = Depends(require_student)):
    session = await db.exam_sessions.find_one({
        "student_id": student["id"],
        "exam_id": exam_id,
        "status": "in_progress"
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="No active exam session found")
    
    marks_obtained = await calculate_marks(exam_id, session.get("answers", []))
    
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
    total_marks = 0
    questions = await db.questions.find({"exam_id": exam_id}).to_list(1000)
    question_map = {str(q["_id"]): q for q in questions}
    
    for answer in answers:
        question = question_map.get(answer["question_id"])
        if not question:
            continue
        
        if question["question_type"] == "mcq":
            correct_option = None
            for opt in question.get("options", []):
                if opt.get("is_correct"):
                    correct_option = opt["id"]
                    break
            
            if answer["answer"] == correct_option:
                total_marks += question["marks"]
        
        elif question["question_type"] == "short_answer":
            if question.get("correct_answer"):
                if answer["answer"].strip().lower() == question["correct_answer"].strip().lower():
                    total_marks += question["marks"]
    
    return total_marks

# ==================== Fraud Detection Routes ====================

@api_router.post("/student/fraud-event")
async def log_fraud_event(data: FraudLogCreate, student: Dict = Depends(require_student)):
    session = await db.exam_sessions.find_one({"_id": ObjectId(data.exam_session_id)})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["student_id"] != student["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    fraud_event = {
        "fraud_type": data.fraud_type,
        "details": data.details,
        "timestamp": datetime.utcnow(),
        "risk_delta": data.risk_score_delta,
        "metadata": data.metadata
    }
    
    new_risk_score = min(100, session.get("risk_score", 0) + data.risk_score_delta)
    
    await db.exam_sessions.update_one(
        {"_id": session["_id"]},
        {
            "$push": {"fraud_events": fraud_event},
            "$set": {"risk_score": new_risk_score, "updated_at": datetime.utcnow()}
        }
    )
    
    if new_risk_score >= 80:
        await db.exam_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {
                "status": "auto_submitted",
                "end_time": datetime.utcnow()
            }}
        )
    
    return {"message": "Event logged", "risk_score": new_risk_score}

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "Geography PUC Test Center API", "version": "2.0.0", "developer": "Dintea"}

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
