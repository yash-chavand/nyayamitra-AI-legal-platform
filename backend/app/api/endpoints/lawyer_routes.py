import json
import os
import io
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pypdf import PdfReader
from ...db.database import get_db
from ...db.models import User, SimilaritySearch, CaseMetadata, Hearing, ClientMatter
from ...core.auth import get_current_user, require_lawyer
from ...schemas.schemas import SimilarityRequest, MatterRequest, IntakeSubmission
from ...services.vector_service import vector_service

router = APIRouter(tags=["Lawyer - Case Similarity"])

@router.get("/matters")
def list_matters(current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    matters = db.query(ClientMatter).filter(ClientMatter.user_id == current_user.id).order_by(ClientMatter.created_at.desc()).all()
    return [{
        "id": m.id, "client_name": m.client_name, "contact_email": m.contact_email,
        "matter_title": m.matter_title, "status": m.status, "next_action": m.next_action,
        "next_action_date": m.next_action_date, "notes": m.notes,
        "intake_token": m.intake_token, "intake_expires_at": m.intake_expires_at,
        "intake_submitted_at": m.intake_submitted_at, "intake_data": json.loads(m.intake_data) if m.intake_data else None
    } for m in matters]

@router.post("/matters")
def create_matter(body: MatterRequest, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    if not body.client_name.strip() or not body.matter_title.strip():
        raise HTTPException(status_code=400, detail="Client name and matter title are required")
    matter = ClientMatter(
        user_id=current_user.id, client_name=body.client_name.strip(),
        contact_email=body.contact_email, matter_title=body.matter_title.strip(),
        status=body.status or "Intake", next_action=body.next_action,
        next_action_date=body.next_action_date, notes=body.notes,
        intake_token=secrets.token_urlsafe(32),
        intake_expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(matter)
    db.commit()
    db.refresh(matter)
    return {"id": matter.id, "client_name": matter.client_name, "matter_title": matter.matter_title,
            "status": matter.status, "intake_token": matter.intake_token,
            "intake_expires_at": matter.intake_expires_at}

@router.delete("/matters/{matter_id}")
def delete_matter(matter_id: int, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    matter = db.query(ClientMatter).filter(ClientMatter.id == matter_id, ClientMatter.user_id == current_user.id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")
    db.delete(matter)
    db.commit()
    return {"message": "Matter deleted"}

@router.put("/matters/{matter_id}")
def update_matter(matter_id: int, body: MatterRequest, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    matter = db.query(ClientMatter).filter(ClientMatter.id == matter_id, ClientMatter.user_id == current_user.id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")
    for field in ("client_name", "contact_email", "matter_title", "status", "next_action", "next_action_date", "notes"):
        value = getattr(body, field)
        if value is not None:
            setattr(matter, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(matter)
    return {"id": matter.id, "client_name": matter.client_name, "contact_email": matter.contact_email,
            "matter_title": matter.matter_title, "status": matter.status, "next_action": matter.next_action,
            "next_action_date": matter.next_action_date, "notes": matter.notes,
            "intake_token": matter.intake_token, "intake_submitted_at": matter.intake_submitted_at,
            "intake_data": json.loads(matter.intake_data) if matter.intake_data else None}

def _active_intake(token: str, db: Session):
    matter = db.query(ClientMatter).filter(ClientMatter.intake_token == token).first()
    if not matter:
        raise HTTPException(status_code=404, detail="This intake link is invalid")
    expires_at = matter.intake_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This intake link has expired")
    return matter

@router.get("/intake/{token}")
def get_intake_form(token: str, db: Session = Depends(get_db)):
    matter = _active_intake(token, db)
    if matter.intake_submitted_at:
        raise HTTPException(status_code=409, detail="This intake form has already been submitted")
    lawyer = db.query(User).filter(User.id == matter.user_id).first()
    return {"matter_title": matter.matter_title, "lawyer_name": lawyer.username if lawyer else "Your lawyer"}

@router.post("/intake/{token}")
def submit_intake(token: str, body: IntakeSubmission, db: Session = Depends(get_db)):
    matter = _active_intake(token, db)
    if matter.intake_submitted_at:
        raise HTTPException(status_code=409, detail="This intake form has already been submitted")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Consent is required to send this information")
    if not body.full_name.strip() or not body.email.strip() or not body.matter_summary.strip():
        raise HTTPException(status_code=400, detail="Name, email, and matter summary are required")
    matter.intake_data = json.dumps(body.dict(), ensure_ascii=False)
    matter.intake_submitted_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Your information was sent securely to the lawyer."}

@router.post("/similar-cases")
def similar_cases(body: SimilarityRequest, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Empty query")
    
    search_query = body.query
    lang = body.language or "English"
    if lang.lower() not in ["english", "en"]:
        search_query = vector_service.translate_to_english(body.query)
        print(f"DEBUG: Translated lawyer query '{body.query}' to '{search_query}'")

    cases = vector_service.find_similar_cases(search_query, k=max(body.k or 5, 25))
    metadata_by_file = {}
    for record in db.query(CaseMetadata).all():
        for candidate in (record.pdf_path, record.case_name):
            if candidate:
                metadata_by_file[os.path.basename(candidate).casefold()] = record
    for case in cases:
        source = os.path.basename(case.get("source") or case.get("pdf_path") or "").casefold()
        record = metadata_by_file.get(source)
        if record:
            case["year"] = record.year if record.year else case.get("year")
            case["case_type"] = record.case_type or case.get("case_type")
            case["pdf_path"] = record.pdf_path or case.get("pdf_path")
    if body.court:
        cases = [case for case in cases if body.court.casefold() in str(case.get("court", "")).casefold()]
    if body.case_type:
        cases = [case for case in cases if body.case_type.casefold() in str(case.get("case_type", "")).casefold()]
    if body.year_from is not None:
        cases = [case for case in cases if str(case.get("year", "")).isdigit() and int(case["year"]) >= body.year_from]
    if body.year_to is not None:
        cases = [case for case in cases if str(case.get("year", "")).isdigit() and int(case["year"]) <= body.year_to]
    cases = cases[:max(1, min(body.k or 5, 20))]
    
    # Ensure PDF links are properly mapped for the frontend
    for case in cases:
        if case.get("pdf_path"):
            filename = os.path.basename(case["pdf_path"])
            case["link"] = f"/data/judgments/{filename}"
        elif case.get("link") == "N/A":
            case["link"] = None

    strategy = None
    if body.include_strategy:
        strategy = vector_service.get_litigation_strategy(search_query, cases, language=lang)
    
    db.add(SimilaritySearch(
        user_id=current_user.id,
        query=body.query,
        results_json=json.dumps(cases)
    ))
    db.commit()
    return {"query": body.query, "cases": cases, "strategy": strategy, "translated_query": search_query if lang.lower() not in ["english", "en"] else None}

@router.get("/cases")
def list_cases(current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    cases = db.query(CaseMetadata).all()
    results = []
    for c in cases:
        link = c.link
        if c.pdf_path:
            filename = os.path.basename(c.pdf_path)
            link = f"/data/judgments/{filename}"
        
        if link == "N/A":
            link = None
            
        results.append({
            "id": c.id,
            "case_name": c.case_name,
            "year": c.year,
            "case_type": c.case_type,
            "pdf_path": c.pdf_path,
            "link": link
        })
    return results

@router.get("/history")
def get_search_history(current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    history = db.query(SimilaritySearch).filter(SimilaritySearch.user_id == current_user.id).all()
    # Fix links in results_json for old search results
    for item in history:
        if item.results_json:
            try:
                results = json.loads(item.results_json)
                fixed = False
                for case in results:
                    if case.get("link") == "N/A" and case.get("pdf_path"):
                        filename = os.path.basename(case["pdf_path"])
                        case["link"] = f"/data/judgments/{filename}"
                        fixed = True
                    elif case.get("link") == "N/A":
                        case["link"] = None
                        fixed = True
                if fixed:
                    item.results_json = json.dumps(results) # Don't commit yet to avoid heavy DB writes, but it serves correctly
            except:
                continue
    return history

@router.post("/ask-case")
def ask_case_specific(body: dict, current_user: User = Depends(require_lawyer)):
    question = body.get("question")
    case_name = body.get("case_name")
    if not question or not case_name:
        raise HTTPException(status_code=400, detail="Missing question or case_name")
    
    answer = vector_service.get_case_specific_answer(question, case_name)
    return {"answer": answer}

@router.post("/summarize-document")
def summarize_doc(file: UploadFile = File(...), current_user: User = Depends(require_lawyer)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = file.file.read()
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF file")
            
        summary = vector_service.summarize_legal_document(text)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

@router.get("/hearings")
def list_hearings(current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    return db.query(Hearing).filter(Hearing.user_id == current_user.id).order_by(Hearing.hearing_date.asc()).all()

@router.post("/hearings")
def create_hearing(body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    case_title = body.get("case_title")
    hearing_date = body.get("hearing_date")
    if not case_title or not hearing_date:
        raise HTTPException(status_code=400, detail="case_title and hearing_date are required")
        
    hearing = Hearing(
        user_id=current_user.id,
        case_title=case_title,
        hearing_date=hearing_date,
        bench=body.get("bench"),
        stage=body.get("stage"),
        notes=body.get("notes")
    )
    db.add(hearing)
    db.commit()
    db.refresh(hearing)
    return hearing

@router.put("/hearings/{hearing_id}")
def update_hearing(hearing_id: int, body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    hearing = db.query(Hearing).filter(Hearing.id == hearing_id, Hearing.user_id == current_user.id).first()
    if not hearing:
        raise HTTPException(status_code=404, detail="Hearing not found")
        
    hearing.case_title = body.get("case_title", hearing.case_title)
    hearing.hearing_date = body.get("hearing_date", hearing.hearing_date)
    hearing.bench = body.get("bench", hearing.bench)
    hearing.stage = body.get("stage", hearing.stage)
    hearing.notes = body.get("notes", hearing.notes)
    
    db.commit()
    db.refresh(hearing)
    return hearing

@router.delete("/hearings/{hearing_id}")
def delete_hearing(hearing_id: int, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    hearing = db.query(Hearing).filter(Hearing.id == hearing_id, Hearing.user_id == current_user.id).first()
    if not hearing:
        raise HTTPException(status_code=404, detail="Hearing not found")
        
    db.delete(hearing)
    db.commit()
    return {"message": "Hearing deleted successfully"}
