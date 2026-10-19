from pydantic import BaseModel
from typing import Dict, Any, Optional

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "citizen"   # "citizen" | "lawyer"

class LoginRequest(BaseModel):
    email: str
    password: str

class QuestionRequest(BaseModel):
    question: str
    language: Optional[str] = "English"

class SimilarityRequest(BaseModel):
    query: str
    k: Optional[int] = 5
    include_strategy: Optional[bool] = True
    language: Optional[str] = "English"
    court: Optional[str] = None
    case_type: Optional[str] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None

class DocumentRequest(BaseModel):
    doc_type: str
    fields: Dict[str, Any]

class MatterRequest(BaseModel):
    client_name: str
    contact_email: Optional[str] = None
    matter_title: str
    status: Optional[str] = "Intake"
    next_action: Optional[str] = None
    next_action_date: Optional[str] = None
    notes: Optional[str] = None

class IntakeSubmission(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    matter_summary: str
    opposing_party: Optional[str] = None
    important_dates: Optional[str] = None
    consent: bool
