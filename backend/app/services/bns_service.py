import os
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq

# Predefined key mappings for instant offline lookups
BNS_MAPPINGS = {
    "302": {
        "old_section": "Section 302 IPC",
        "new_section": "Section 103(1) BNS",
        "offense": "Murder",
        "old_punishment": "Death or imprisonment for life, and fine.",
        "new_punishment": "Death or imprisonment for life, and fine.",
        "changes": "Substantively identical. Replaced IPC 302 with BNS 103(1)."
    },
    "307": {
        "old_section": "Section 307 IPC",
        "new_section": "Section 109 BNS",
        "offense": "Attempt to Murder",
        "old_punishment": "Imprisonment up to 10 years, and fine; if hurt is caused, up to life imprisonment.",
        "new_punishment": "Imprisonment up to 10 years, and fine; if hurt is caused, up to life imprisonment.",
        "changes": "Moved to Section 109 BNS without major change in punishment."
    },
    "420": {
        "old_section": "Section 420 IPC",
        "new_section": "Section 318(4) BNS",
        "offense": "Cheating and dishonestly inducing delivery of property",
        "old_punishment": "Imprisonment up to 7 years, and fine.",
        "new_punishment": "Imprisonment up to 7 years, and fine.",
        "changes": "Cheating is consolidated under Section 318 BNS. Sub-section (4) covers the specific offense of cheating and dishonestly inducing delivery of property."
    },
    "379": {
        "old_section": "Section 379 IPC",
        "new_section": "Section 303(2) BNS",
        "offense": "Theft",
        "old_punishment": "Imprisonment up to 3 years, or fine, or both.",
        "new_punishment": "Imprisonment up to 3 years, or fine, or both; community service for first-time offenders if value is under Rs. 5000.",
        "changes": "Introduced community service as an alternative punishment for minor first-time thefts."
    },
    "120B": {
        "old_section": "Section 120B IPC",
        "new_section": "Section 61(2) BNS",
        "offense": "Criminal Conspiracy",
        "old_punishment": "Same as abetment of the offense; or up to 6 months for other offenses.",
        "new_punishment": "Same as abetment of the offense; or up to 6 months for other offenses.",
        "changes": "Substantively similar. Remapped to Section 61 BNS."
    },
    "34": {
        "old_section": "Section 34 IPC",
        "new_section": "Section 190 BNS",
        "offense": "Common Intention / Joint Liability",
        "old_punishment": "Shared liability as if committed by the individual alone.",
        "new_punishment": "Shared liability as if committed by the individual alone.",
        "changes": "Consolidated under joint liability section."
    },
    "500": {
        "old_section": "Section 500 IPC",
        "new_section": "Section 356 BNS",
        "offense": "Defamation",
        "old_punishment": "Simple imprisonment up to 2 years, or fine, or both.",
        "new_punishment": "Simple imprisonment up to 2 years, or fine, or both, or community service.",
        "changes": "Adds community service as a progressive alternative punishment option."
    },
    "124A": {
        "old_section": "Section 124A IPC",
        "new_section": "Section 152 BNS",
        "offense": "Acts endangering sovereignty, unity, and integrity of India (Sedition replacement)",
        "old_punishment": "Life imprisonment or up to 3 years, and fine.",
        "new_punishment": "Life imprisonment or up to 7 years, and fine.",
        "changes": "The word 'Sedition' is removed. Section 152 BNS now targets activities promoting secession, armed rebellion, subversive activities, or endangering sovereignty, unity, and integrity of India, with increased minimum prison terms."
    },
    "304B": {
        "old_section": "Section 304B IPC",
        "new_section": "Section 80 BNS",
        "offense": "Dowry Death",
        "old_punishment": "Imprisonment not less than 7 years, up to life.",
        "new_punishment": "Imprisonment not less than 7 years, up to life.",
        "changes": "Moved to Section 80 BNS with identical punishment guidelines."
    },
    "376": {
        "old_section": "Section 376 IPC",
        "new_section": "Section 64 BNS",
        "offense": "Punishment for Rape",
        "old_punishment": "Rigorous imprisonment not less than 10 years, up to life, and fine.",
        "new_punishment": "Rigorous imprisonment not less than 10 years, up to life, and fine.",
        "changes": "Consolidated under Chapter V of the BNS dealing with sexual offenses against women and children."
    }
}

class BNSService:
    def __init__(self):
        self.llm = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1
        )

    def lookup(self, query: str) -> dict:
        # Extract digits from query to check predefined keys
        clean_query = "".join(filter(str.isdigit, query))
        
        # Check instant database first
        if clean_query in BNS_MAPPINGS:
            entry = BNS_MAPPINGS[clean_query].copy()
            entry["analysis"] = f"Instant verification of {entry['old_section']} to {entry['new_section']} successful."
            return entry

        # Fallback to LLM for dynamic mapping
        system_prompt = (
            "You are an expert Indian Legal Scholar specializing in the transition from old criminal laws "
            "(IPC, CrPC, Indian Evidence Act) to the new laws (BNS, BNSS, BSA). "
            "Map the requested section query. You MUST respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            "  \"old_section\": \"Old law section number and act name (e.g. Section 306 IPC)\",\n"
            "  \"new_section\": \"New law section number and act name (e.g. Section 108 BNS)\",\n"
            "  \"offense\": \"Offense title\",\n"
            "  \"old_punishment\": \"Old punishment details\",\n"
            "  \"new_punishment\": \"New punishment details\",\n"
            "  \"changes\": \"Key differences, definitions, or procedural updates\",\n"
            "  \"analysis\": \"Short explanation of structural change or legal context\"\n"
            "}"
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Map the legal section: {query}")
        ]

        try:
            res = self.llm.invoke(messages).content
            # Locate JSON boundaries in response to avoid system wrapping
            start = res.find("{")
            end = res.rfind("}") + 1
            if start != -1 and end != -1:
                return json.loads(res[start:end])
            return json.loads(res)
        except Exception as e:
            print(f"BNS LLM mapping failed: {e}")
            return {
                "old_section": f"Section {query} (IPC/CrPC)",
                "new_section": "BNS Section pending lookup",
                "offense": "Unknown / Pending AI connection",
                "old_punishment": "N/A",
                "new_punishment": "N/A",
                "changes": "Offline mode: Configure GROQ_API_KEY to search dynamic BNS mappings.",
                "analysis": f"Search failed: {str(e)}"
            }

bns_service = BNSService()
