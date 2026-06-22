import json
import re
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...db.models import User, LawyerDocument
from ...core.auth import require_lawyer
from ...services.vector_service import vector_service
from fpdf import FPDF
import io

router = APIRouter(tags=["Lawyer - Litigation Documents"])

@router.post("/generate-bail")
def generate_bail(body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    details = body.get("details")
    case_title = body.get("case_title", "Bail Application")
    if not details:
        raise HTTPException(status_code=400, detail="Missing details")
    
    content = vector_service.generate_lawyer_litigation_document("bail", {"details": details})
    
    doc = LawyerDocument(
        user_id=current_user.id,
        document_type="bail",
        case_title=case_title,
        content=content,
        form_data=json.dumps(body)
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.post("/generate-legal-notice")
def generate_legal_notice(body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    details = body.get("details")
    case_title = body.get("case_title", "Legal Notice")
    if not details:
        raise HTTPException(status_code=400, detail="Missing details")
    
    content = vector_service.generate_lawyer_litigation_document("legal_notice", {"details": details})
    
    doc = LawyerDocument(
        user_id=current_user.id,
        document_type="legal_notice",
        case_title=case_title,
        content=content,
        form_data=json.dumps(body)
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.post("/generate-written-arguments")
def generate_written_arguments(body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    details = body.get("details")
    case_title = body.get("case_title", "Written Arguments")
    if not details:
        raise HTTPException(status_code=400, detail="Missing details")
    
    content = vector_service.generate_lawyer_litigation_document("written_arguments", {"details": details})
    
    doc = LawyerDocument(
        user_id=current_user.id,
        document_type="written_arguments",
        case_title=case_title,
        content=content,
        form_data=json.dumps(body)
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.get("/")
def list_documents(current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    return db.query(LawyerDocument).filter(LawyerDocument.user_id == current_user.id).order_by(LawyerDocument.created_at.desc()).all()

def html_to_plain_text(html_content: str) -> str:
    if not html_content:
        return ""
    # Convert common paragraph/line break tags to newlines
    text = html_content.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    text = re.sub(r'</div>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    # Strip all other HTML tags
    text = re.sub(r'<[^>]*>', '', text)
    # Decode common HTML entities
    text = text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return text

@router.post("/export-pdf")
def export_pdf(body: dict, current_user: User = Depends(require_lawyer)):
    content = body.get("content")
    title = body.get("title", "Document")
    if not content:
        raise HTTPException(status_code=400, detail="No content to export")
    
    clean_content = html_to_plain_text(content)
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    
    # Handle multi-line content
    for line in clean_content.split('\n'):
        # fpdf2 handles unicode much better - no need to encode/decode manually
        pdf.multi_cell(0, 10, txt=line)
    
    # output() returns bytes in fpdf2 if no filename is given
    pdf_bytes = pdf.output()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={title.replace(' ', '_')}.pdf"}
    )

@router.put("/{doc_id}")
def update_document(doc_id: int, body: dict, current_user: User = Depends(require_lawyer), db: Session = Depends(get_db)):
    doc = db.query(LawyerDocument).filter(LawyerDocument.id == doc_id, LawyerDocument.user_id == current_user.id).first()
    if not doc: 
        raise HTTPException(status_code=404, detail="Not found")
    
    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing content")
    
    doc.content = content
    db.commit()
    return {"message": "Updated successfully", "content": doc.content}
