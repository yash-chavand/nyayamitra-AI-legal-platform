import json
import os
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pypdf import PdfReader
from ...db.database import get_db
from ...db.models import User, SimilaritySearch, CaseMetadata, Hearing
from ...core.auth import get_current_user, require_lawyer
from ...schemas.schemas import SimilarityRequest
from ...services.vector_service import vector_service

router = APIRouter(tags=["Lawyer - Case Similarity"])

@router.post("/similar-cases")
def similar_cases(body: SimilarityRequest, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Empty query")
    
    search_query = body.query
    lang = body.language or "English"
    if lang.lower() not in ["english", "en"]:
        search_query = vector_service.translate_to_english(body.query)
        print(f"DEBUG: Translated lawyer query '{body.query}' to '{search_query}'")

    cases = vector_service.find_similar_cases(search_query, k=body.k)
    
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
