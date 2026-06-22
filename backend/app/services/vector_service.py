import os
from datetime import datetime
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
import time

load_dotenv()

# Standardized paths for the restructured project
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(APP_DIR)
CITIZEN_FAISS_DIR = os.path.join(BASE_DIR, "data", "vectors", "citizen")
LAWYER_FAISS_DIR  = os.path.join(BASE_DIR, "data", "judgments_index")

embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")

def load_vectorstore(path: str, index_name: str = "index"):
    if not os.path.exists(path) or not os.listdir(path):
        print(f"⚠️ Vector store not found at {path}")
        return None
    return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True, index_name=index_name)

class VectorService:
    def __init__(self):
        self.citizen_vs = load_vectorstore(CITIZEN_FAISS_DIR)
        self.lawyer_vs  = load_vectorstore(LAWYER_FAISS_DIR, index_name="lawyer_case_index")
        self.llm = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.6
        )

    def translate_to_english(self, text: str) -> str:
        messages = [
            SystemMessage(content="You are a precise translator. Translate the following user query into concise English for database search. Respond ONLY with the translation, nothing else."),
            HumanMessage(content=text)
        ]
        try:
            res = self.llm.invoke(messages)
            return res.content.strip()
        except Exception as e:
            print(f"Translation failed: {e}")
            return text

    def get_citizen_answer(self, question: str, intent: str, instruction: str, language: str = "English"):
        if not self.citizen_vs:
            return {"answer": "Knowledge base not loaded.", "sources": []}
        
        # Translate to English if target language is not English
        search_query = question
        is_multilingual = language.lower() not in ["english", "en"]
        if is_multilingual:
            search_query = self.translate_to_english(question)
            print(f"DEBUG: Translated user query '{question}' to '{search_query}'")

        print(f"DEBUG: Starting citizen search for: {search_query[:30]}...")
        start = time.time()
        docs = self.citizen_vs.similarity_search(search_query, k=3)
        print(f"DEBUG: Search took {time.time()-start:.2f}s")
        
        context = "\n\n".join([f"[{d.metadata.get('law_name', 'Law')}, pg {d.metadata.get('page','?')}]\n{d.page_content}" for d in docs])
        
        if is_multilingual:
            system_prompt = f"You are a friendly Indian legal assistant. You MUST write your entire answer in {language}. Use plain language. Keep it under 200 words."
        else:
            system_prompt = "You are a friendly Indian legal assistant. Use plain English. Keep it under 200 words."

        prompt = f"Context:\n{context}\n\nUser Intent: {intent}\nInstruction: {instruction}\n\nQuestion (original): {question}\nQuestion (in English): {search_query}"
        
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        
        print(f"DEBUG: Invoking LLM...")
        start = time.time()
        try:
            response = self.llm.invoke(messages)
            answer = response.content
            print(f"DEBUG: LLM took {time.time()-start:.2f}s")
        except Exception as e:
            print(f"ERROR: LLM invocation failed: {e}")
            answer = f"⚠️ [Local Demo Mode - LLM Offline]\n\nBased on Indian legal context for your query:\n\n{context[:600]}...\n\n(To enable full AI chat, please configure a valid GROQ_API_KEY in the backend/.env file)"
        
        sources = [{"law": d.metadata.get("law_name"), "page": d.metadata.get("page")} for d in docs]
        return {
            "answer": answer,
            "sources": sources,
            "translated_query": search_query if is_multilingual else None
        }

    def find_similar_cases(self, query: str, k: int = 5):
        if not self.lawyer_vs:
            return []
        
        docs_with_scores = self.lawyer_vs.similarity_search_with_score(query, k=k)
        results = []
        for doc, score in docs_with_scores:
            case_id = doc.metadata.get("case_id", "Unknown Case")
            results.append({
                "case_name": case_id.replace("_", " ").title(),
                "year": doc.metadata.get("year", "N/A"),
                "excerpt": doc.page_content[:500] + "...",
                "similarity": round(1 - score, 3),
                "pdf_path": doc.metadata.get("pdf_path")
            })
        return results

    def get_litigation_strategy(self, query: str, cases: list, language: str = "English"):
        context = "\n".join([f"Case: {c['case_name']}\nExcerpt: {c['excerpt']}" for c in cases])
        prompt = f"""
            You are a senior Indian criminal law researcher assisting in litigation strategy.
            
            Task:
            Provide a detailed litigation strategy and analyze actual Indian Supreme Court/High Court precedents based on the provided similar cases for the following situation:
            {query}

            Similar Cases Context:
            {context}

            Instructions for Output:
            1. Analyze the situation considering:
               - Lack of direct evidence
               - No recovery from possession
               - Weak or incomplete chain of circumstantial evidence
               - Mere suspicion or presence at scene

            2. For each relevant case from the context:
               - Case Name
               - Court Name
               - Year
               - Citation (if available in metadata)
               - Brief facts (2-3 lines)
               - Legal principle laid down
               - Exact relevant observation (if possible)
               - Application to present case: Explain how it applies to the fact pattern.

            3. Format strictly as follows for each case:
               CASE [Number]:
               Case Name:
               Court:
               Citation:
               Facts:
               Held:
               Relevant Observation:
               Application to Present Case:

            4. End with:
               Suggested defence argument structure based on above precedents.

            CRITICAL: Do NOT provide placeholder judgments like 'Judgment 119'. Use the real case names provided in the context.
        """
        
        is_multilingual = language.lower() not in ["english", "en"]
        if is_multilingual:
            system_prompt = f"You are a Senior Indian Advocate and criminal law researcher. You MUST write your entire analysis and strategy in {language}."
        else:
            system_prompt = "You are a Senior Indian Advocate and criminal law researcher."

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt)
        ]
        print(f"DEBUG: Generating Litigation Strategy for: {query[:30]}...")
        start = time.time()
        try:
            strategy = self.llm.invoke(messages).content
            print(f"DEBUG: Strategy generation took {time.time()-start:.2f}s")
        except Exception as e:
            print(f"ERROR: LLM invocation failed: {e}")
            strategy = f"⚠️ [Local Demo Mode - LLM Offline]\n\nBased on similar cases found in the repository, you can review the following context to draft your strategy:\n\n{context[:1000]}...\n\n(To enable full AI strategy generation, please configure a valid GROQ_API_KEY in the backend/.env file)"
        return strategy

    def get_case_specific_answer(self, question: str, case_name: str):
        if not self.lawyer_vs:
            return "Lawyer knowledge base not loaded."
        
        # Search specifically for chunks belonging to this case
        # Note: Filtering in FAISS can be done via metadata if the index facilitates it
        docs = self.lawyer_vs.similarity_search(f"Case: {case_name}. Question: {question}", k=5)
        context = "\n\n".join([d.page_content for d in docs])
        
        prompt = f"Using the following excerpts from the case '{case_name}', answer the question: {question}\n\nContext:\n{context}"
        
        messages = [
            SystemMessage(content="You are a legal research assistant analyzing a specific Indian Supreme Court judgment. Answer based ONLY on the provided context."),
            HumanMessage(content=prompt)
        ]
        try:
            return self.llm.invoke(messages).content
        except Exception as e:
            print(f"ERROR: LLM invocation failed: {e}")
            return f"⚠️ [Local Demo Mode - LLM Offline]\n\nAnswer based on case excerpts:\n\n{context[:600]}...\n\n(To enable full AI chat, please configure a valid GROQ_API_KEY in the backend/.env file)"

    def generate_legal_document(self, doc_type: str, description: str):
        prompts = {
            "police_complaint": """
                Draft a formal Police Complaint (First Information Report - FIR) for the Indian Police.
                CRITICAL INSTRUCTION: DO NOT use any markdown formatting, asterisks (**), or special characters for bolding. 
                Use only plain text with standard capitalization for headings.
                
                Include:
                - To: The Station House Officer (SHO), [Police Station Name]
                - Subject: Formal complaint regarding [Topic]
                - Details of Incident: {desc}
                - Legal Sections: Mention relevant IPC sections (e.g., Section 379 for Theft).
                - Request: A request to register an FIR and take necessary action.
                Format it like a professional physical letter.
            """,
            "consumer_complaint": """
                Draft a formal Consumer Complaint under the Consumer Protection Act 2019.
                CRITICAL INSTRUCTION: DO NOT use any markdown formatting, asterisks (**), or special characters for bolding. 
                Use only plain text with standard capitalization for headings.
                
                Include:
                - Before the District Consumer Disputes Redressal Commission
                - Subject: Complaint against [Company/Service] for [Deficiency]
                - Facts: {desc}
                - Prayer: Request for refund, compensation, and legal costs.
                Format it strictly like a formal legal petition.
            """,
            "rti_application": """
                Draft a formal RTI Application under the Right to Information Act 2005.
                CRITICAL INSTRUCTION: DO NOT use any markdown formatting, asterisks (**), or special characters for bolding. 
                Use only plain text with standard capitalization for headings.
                
                Include:
                - To: The Public Information Officer (PIO), [Department Name]
                - Subject: Request for information under RTI Act 2005
                - Information Sought: {desc}
                - Declaration: A statement that I am a citizen of India.
                Use the standard Government of India RTI format.
            """
        }
        
        template = prompts.get(doc_type, "Draft a professional legal document in plain text (no markdown) based on: {desc}")
        prompt = template.format(desc=description)
        
        messages = [
            SystemMessage(content="You are an expert Legal Draftsman in India. You write documents for physical submission. NEVER use markdown bolding (**) or any other markdown syntax. Use only plain text and standard letter formatting."),
            HumanMessage(content=prompt)
        ]
        try:
            return self.llm.invoke(messages).content
        except Exception as e:
            print(f"ERROR: LLM invocation failed: {e}")
            if doc_type == "police_complaint":
                return f"""FORMAL POLICE COMPLAINT (MISSING PERSON / GENERAL INDICTMENT)

To,
The Station House Officer (SHO),
[Police Station Name / Concerned Jurisdiction]
[City, District, State]

Date: {datetime.now().strftime('%d %B %Y')}

SUBJECT: Urgent Complaint and Request to Register FIR regarding: {description[:80]}

Respected Sir/Madam,

I, the undersigned, hereby submit this formal complaint for immediate registration of a First Information Report (FIR) and investigation into the following incident:

DETAILS OF INCIDENT:
{description}

DETAILS OF PERSON(S) INVOLVED / AFFECTED:
1. Subject Name: [Full name of the affected person, e.g., missing brother]
2. Age: [Age] | Gender: [Gender]
3. Height: [Height] | Complexion: [Complexion]
4. Wearings: [Last known clothing]
5. Last Seen Location: [Location where last seen]
6. Date & Time of Occurrence: [Date & Time]

LEGAL SECTIONS INVOLVED (PRELIMINARY):
- Missing Person Report / Section 365 of the Indian Penal Code, 1860 (IPC) (or relevant Bharatiya Nyaya Sanhita - BNS sections) depending on investigation findings.

REQUEST FOR ACTION:
It is most respectfully prayed that an FIR be registered immediately under the relevant provisions of the law, and prompt search and rescue operations be initiated. Please keep the complainant updated on any progress.

Yours faithfully,

____________________________
[Signature of Complainant]
Name: [Complainant's Full Name]
Address: [Complainant's Address]
Mobile Number: [Complainant's Phone Number]
Email: [Complainant's Email]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            elif doc_type == "consumer_complaint":
                return f"""BEFORE THE HON'BLE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION AT [DISTRICT NAME]

Consumer Complaint No. ________ of 2026

IN THE MATTER OF:
[Complainant Name]
[Complainant Address]
... COMPLAINANT

VERSUS

[Opposite Party Name / Company Name]
[Opposite Party Address]
... OPPOSITE PARTY / RESPONDENT

COMPLAINT UNDER SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019

MOST RESPECTHOW SHOWETH:

1. That the Complainant is a consumer who purchased / availed services from the Opposite Party.
2. Description of the Transaction: [Enter product/service purchase details, invoice no., and date]
3. Details of Deficiency in Service / Defective Product:
{description}
4. That the Complainant suffered significant financial loss and mental harassment due to the actions/omissions of the Opposite Party.
5. Jurisdiction: The cause of action arose within the territorial limits of this Hon'ble Commission.

PRAYER:
It is, therefore, most respectfully prayed that this Hon'ble Commission may be pleased to direct the Opposite Party to:
a. Refund the amount of Rs. [Purchase Price] along with interest @ [e.g., 9%] p.a.
b. Pay compensation of Rs. [Compensation Amount] for mental agony and harassment.
c. Pay litigation costs of Rs. [Litigation Cost].
d. Pass any other order(s) this Hon'ble Commission deems fit in the interest of justice.

Filed by:
____________________________
[Signature of Complainant / Counsel]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            elif doc_type == "rti_application":
                return f"""RTI APPLICATION FORM under Section 6(1) of the Right to Information Act, 2005

To,
The Public Information Officer (PIO) / Assistant PIO,
[Department Name / Government Office]
[Address of Department]

Date: {datetime.now().strftime('%d %B %Y')}

1. Full Name of the Applicant: [Your Full Name]
2. Gender: Male / Female / Other
3. Complete Postal Address: [Your Postal Address]
4. Mobile No. & Email: [Your Contact Info]
5. Whether Citizen of India: Yes (Only Indian Citizens are eligible)
6. Particulars of Information sought:
{description}
7. Period for which information is required: [Specify dates, e.g. Year 2025-2026]
8. Format of Information: Written / Photocopy / Electronic
9. Application Fee Details:
   - Postal Order / Demand Draft No: [DD/IPO Number] dated [Date] for Rs. 10/-
   - (Or) Check here if Applicant belongs to BPL Category (No fee required, enclose BPL Card copy): [ ]

Declaration: I state that I am a citizen of India and the information requested falls within the purview of the RTI Act, 2005.

Yours faithfully,

____________________________
[Signature of the Applicant]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            else:
                return f"""FORMAL LEGAL DRAFT

SUBJECT: Request / Application regarding: {description[:80]}

Date: {datetime.now().strftime('%d %B %Y')}

DETAILS / FACTS:
{description}

RELIEF / ACTION REQUESTED:
[Complainant requests the concerned authority to take immediate action on the facts mentioned above.]

Sincerely,

____________________________
[Signature of Complainant]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

    def generate_lawyer_litigation_document(self, doc_type: str, data: dict):
        """Generates professional litigation documents for lawyers with specific prompts."""
        prompts = {
            "bail": f"""
                You are a senior Indian criminal lawyer drafting a professional bail application.
                Structure the document as:
                1. Court heading
                2. Case details
                3. Brief facts
                4. Grounds for bail:
                   - No criminal antecedents
                   - No recovery
                   - No direct evidence
                   - Weak circumstantial chain
                   - Long custody (if applicable)
                5. Legal principles
                6. Prayer clause
                Use formal Indian court format.
                Details: {data.get('details')}
            """,
            "legal_notice": f"""
                You are a professional Indian advocate drafting a legal notice.
                Structure:
                1. Sender details
                2. Recipient details
                3. Facts
                4. Legal breach
                5. Demand
                6. Time limit
                7. Legal consequences
                Use professional legal tone.
                Details: {data.get('details')}
            """,
            "written_arguments": f"""
                You are a senior advocate preparing written arguments.
                Structure:
                1. Brief facts
                2. Issues
                3. Evidence analysis
                4. Contradictions
                5. Relevant legal principles
                6. Benefit of doubt
                7. Prayer
                Use structured court format.
                Details: {data.get('details')}
            """
        }
        
        prompt = prompts.get(doc_type, f"Draft a professional legal document based on: {data.get('details')}")
        
        messages = [
            SystemMessage(content="You are a Senior Indian Advocate. You write high-quality, professional court documents. Use plain text formatting, no markdown stars or bolding."),
            HumanMessage(content=prompt)
        ]
        try:
            return self.llm.invoke(messages).content
        except Exception as e:
            print(f"ERROR: LLM invocation failed: {e}")
            details = data.get('details', '')
            if doc_type == "bail":
                return f"""IN THE COURT OF THE HON'BLE SESSIONS JUDGE AT [DISTRICT NAME, STATE]

Bail Application No. ________ of 2026

IN THE MATTER OF:
State   ... PROSECUTION

VERSUS

[Accused / Client Name]   ... APPLICANT / ACCUSED

APPLICATION UNDER SECTION 439 OF THE CODE OF CRIMINAL PROCEDURE, 1973 FOR THE GRANT OF BAIL ON BEHALF OF THE APPLICANT

MOST RESPECTFULLY SHOWETH:

1. That the Applicant / Accused has been falsely implicated in FIR No. [FIR Number] registered under Section(s) [e.g. 379 IPC] at Police Station [Police Station Name].
2. That the Applicant was arrested on [Arrest Date] and is currently in judicial custody.
3. Ground of Bail - Innocence: The Applicant is completely innocent and has no concern with the alleged offense.
4. Ground of Bail - Absence of Direct Evidence / No Recovery: There is no direct evidence or recovery of any incriminating material from the possession of the Applicant.
5. Facts & Details of Case:
{details}
6. That the Applicant has no prior criminal history, is a permanent resident of [Address], and there is no risk of them absconding or tampering with evidence.
7. That the Applicant is willing to furnish reasonable bail bonds and surety to the satisfaction of this Hon'ble Court.

PRAYER:
It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to release the Applicant / Accused on bail in the interest of justice.

Filed by:
____________________________
[Advocate for the Applicant]
[Advocate Registration Number]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            elif doc_type == "legal_notice":
                return f"""ADVOCATE [ADVOCATE NAME / OFFICE]
[Office Address, Phone, Email]

Ref No. ____________
Date: {datetime.now().strftime('%d %B %Y')}

TO,
[Recipient / Opposite Party Name]
[Opposite Party Address]

SUBJECT: LEGAL NOTICE FOR RECOVERY OF DUES / BREACH OF CONTRACT

Under instructions from my client, [Client Name], resident of [Client Address], I hereby serve you with this Legal Notice:

1. That my client and you entered into an agreement / transaction on [Date] for [e.g., supply of goods/services].
2. Brief Facts of Transaction & Breach:
{details}
3. That despite multiple reminders and requests, you failed to fulfill your legal obligation and pay the outstanding amount of Rs. [Amount].
4. That your actions constitute a clear breach of contract, resulting in severe financial losses and mental agony to my client.

I, therefore, call upon you to pay the sum of Rs. [Amount] along with interest @ [e.g. 18%] p.a. within 15 days from the receipt of this notice, failing which I have strict instructions to initiate civil and criminal legal proceedings against you in the competent court of law, entirely at your risk and cost.

Yours faithfully,

____________________________
[Signature of Advocate]
Advocate for the Client

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            elif doc_type == "written_arguments":
                return f"""BEFORE THE HON'BLE COURT OF [COURT NAME] AT [PLACE]

In the Matter of:
[Case Number / Title]

WRITTEN SUBMISSIONS / ARGUMENTS ON BEHALF OF THE PETITIONER / DEFENDANT

MOST RESPECTFULLY SUBMITTED:

1. BRIEF FACTS OF THE CASE:
   The case of the prosecution / plaintiff is that [brief background]. However, the defense submits:
{details}

2. ISSUES INVOLVED:
   - Issue No. 1: Whether the prosecution has proved the guilt of the accused beyond reasonable doubt?
   - Issue No. 2: Whether there is any independent corroborative evidence to support the allegations?

3. CONTRADICTIONS & DEFENSE ARGUMENTS:
   - There are material contradictions in the testimony of the prosecution witnesses.
   - The chain of circumstantial evidence is completely broken and incomplete.
   - No recovery has been effected to establish the case of the prosecution.

4. PRAYER:
   In view of the submissions made above and the precedents on record, it is most respectfully prayed that this Hon'ble Court may be pleased to acquit the Accused / grant relief in the interest of justice.

Filed by:
____________________________
[Advocate for the Party]

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

            else:
                return f"""COURT DOCUMENT DRAFT

SUBJECT: Litigation matter regarding: {details[:80]}

Date: {datetime.now().strftime('%d %B %Y')}

FACTS & DETAILS:
{details}

PRAYER / RELIEF CLAUSE:
It is most respectfully prayed that this Hon'ble Court may be pleased to grant the necessary reliefs in the interest of justice.

Filed by:
____________________________
Advocate for the Party

[NOTE: This is a professional draft template generated locally. To enable full AI customization, please configure a valid GROQ_API_KEY in the backend/.env file.]"""

    def summarize_legal_document(self, text: str) -> dict:
        import json
        import re
        messages = [
            SystemMessage(content=(
                "You are an expert Indian legal citation extractor and document summarizer. "
                "Analyze the provided legal document (judgment/petition/brief) and extract the following: "
                "1. case_title: Case title or parties involved\n"
                "2. court_name: Name of the court\n"
                "3. date_of_judgment: Date of judgment/filing\n"
                "4. key_citations: Important case laws, acts, or rules cited\n"
                "5. case_summary: A brief summary of facts and proceedings (under 200 words)\n"
                "6. holding: The final decision or core legal holding of the court\n"
                "7. counter_arguments: Main arguments presented by the opposing side\n\n"
                "You MUST respond ONLY with a valid JSON object matching these 7 keys. Do not include any markdown styling like ```json."
            )),
            HumanMessage(content=text[:12000]) # Limit length to fit context
        ]
        
        try:
            res = self.llm.invoke(messages)
            content = res.content.strip()
            # Clean possible markdown JSON wrappers if LLM still outputs them
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()
            return json.loads(content)
        except Exception as e:
            print(f"Summarization failed: {e}")
            # Fallback mock summary
            title_match = re.search(r'(vs|versus|v\.)\s+([A-Za-z\s]+)', text[:2000], re.IGNORECASE)
            title = f"Case involving {title_match.group(0)}" if title_match else "Extracted Legal Document"
            
            return {
                "case_title": title,
                "court_name": "Court Name (AI Offline)",
                "date_of_judgment": "Not Found",
                "key_citations": ["Not extracted - local fallback mode"],
                "case_summary": (
                    f"This document appears to contain legal content regarding {text[:300]}...\n\n"
                    "(To enable full AI legal document summarization, please configure a valid GROQ_API_KEY in the backend/.env file)"
                ),
                "holding": "Could not extract decision.",
                "counter_arguments": "Could not extract arguments."
            }

vector_service = VectorService()
