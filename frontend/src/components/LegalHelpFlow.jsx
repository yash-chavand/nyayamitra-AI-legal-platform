import { useState } from "react"
import { useNavigate } from "react-router-dom"

const TOPICS = [
    { id: "housing", label: "Rent, housing, or property", prompt: "Help me understand my rights and practical next steps for a housing or property issue." },
    { id: "consumer", label: "A product, service, or payment problem", prompt: "Help me understand my options for a consumer or payment dispute." },
    { id: "work", label: "Workplace or employment", prompt: "Help me understand my options for a workplace or employment issue." },
    { id: "police", label: "Police, arrest, or safety", prompt: "Help me understand the immediate legal steps and rights relevant to a police or safety issue." },
    { id: "family", label: "Family or personal matter", prompt: "Help me understand possible next steps for a family or personal legal matter." },
    { id: "other", label: "Something else", prompt: "Help me understand the legal issue described below and suggest practical next steps." },
]

export default function LegalHelpFlow() {
    const navigate = useNavigate()
    const [topic, setTopic] = useState("")
    const [state, setState] = useState("")
    const [facts, setFacts] = useState("")
    const [when, setWhen] = useState("")
    const [language, setLanguage] = useState("English")
    const [error, setError] = useState("")

    const continueToAssistant = () => {
        if (!topic || facts.trim().length < 20) {
            setError("Choose a topic and describe what happened in at least one sentence.")
            return
        }
        const selected = TOPICS.find(item => item.id === topic)
        const question = `${selected.prompt}\n\nMy state/UT: ${state || "Not specified"}\nWhen it happened: ${when || "Not specified"}\nWhat happened: ${facts.trim()}\n\nPlease explain the relevant options in plain language, cite the legal sources you rely on, identify any urgent deadlines, and tell me what information is still missing. Do not assume facts I have not provided.`
        navigate("/chat", { state: { question, language } })
    }

    const downloadConsultNotes = () => {
        if (!topic || !facts.trim()) { setError("Choose a topic and add a short description first."); return }
        const selected = TOPICS.find(item => item.id === topic)
        const content = ["NYAYAMITRA — CONSULTATION PREPARATION NOTES", "", `Issue: ${selected.label}`, `State/UT: ${state || "Not specified"}`, `When: ${when || "Not specified"}`, "", "What happened:", facts.trim(), "", "Questions for the lawyer:", "1. What options and deadlines apply to my situation?", "2. What documents or evidence should I preserve?", "3. What could the next steps and costs be?", "", "Prepared by the user. This is not a legal opinion."].join("\n")
        const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }))
        const anchor = document.createElement("a")
        anchor.href = url; anchor.download = "nyayamitra-consultation-notes.txt"; anchor.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <div>
                <p className="text-primary text-sm font-semibold">CITIZEN SUPPORT</p>
                <h2 className="text-2xl font-bold text-white mt-1">Get oriented, step by step</h2>
                <p className="text-gray-400 text-sm mt-2">Share only what you’re comfortable sharing. The assistant will use your details to frame its answer and show sources when available.</p>
            </div>
            <div className="card p-6 space-y-5">
                <fieldset>
                    <legend className="text-sm text-white font-semibold mb-3">What is the issue about?</legend>
                    <div className="grid sm:grid-cols-2 gap-2">
                        {TOPICS.map(item => <button type="button" key={item.id} onClick={() => setTopic(item.id)} className={`text-left rounded-xl border px-4 py-3 text-sm transition ${topic === item.id ? "border-primary bg-primary/10 text-white" : "border-border bg-surfaceLight text-gray-300 hover:border-primary/40"}`}>{item.label}</button>)}
                    </div>
                </fieldset>
                <div className="grid sm:grid-cols-2 gap-4">
                    <label className="text-sm text-gray-300">State or Union Territory
                        <input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Maharashtra" className="input mt-2 w-full" />
                    </label>
                    <label className="text-sm text-gray-300">When did it happen?
                        <input value={when} onChange={e => setWhen(e.target.value)} placeholder="Approximate date or timeframe" className="input mt-2 w-full" />
                    </label>
                </div>
                <label className="block text-sm text-gray-300">What happened?
                    <textarea value={facts} onChange={e => setFacts(e.target.value)} rows={5} maxLength={4000} placeholder="Describe the key events, what you have tried, and what outcome you need. Avoid sharing passwords, bank details, or unnecessary identifying information." className="input mt-2 w-full resize-y" />
                    <span className="text-xs text-gray-500">{facts.length}/4000 characters</span>
                </label>
                <label className="block text-sm text-gray-300">Answer language
                    <select value={language} onChange={e => setLanguage(e.target.value)} className="input mt-2 w-full">
                        {["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Urdu"].map(item => <option key={item}>{item}</option>)}
                    </select>
                </label>
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between border-t border-border pt-4">
                    <p className="text-xs text-gray-500 max-w-md">This tool gives general information, not a lawyer-client relationship or a substitute for urgent legal advice.</p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={downloadConsultNotes} className="text-xs text-gray-300 border border-border rounded-lg px-3 py-2.5 hover:border-primary/40">Prepare lawyer notes</button>
                        <button onClick={continueToAssistant} className="btn-primary px-5 py-3">Continue to legal assistant →</button>
                    </div>
                </div>
                <div className="bg-surfaceLight rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">Need a lawyer but unsure where to start? NALSA provides legal aid information and a national helpline.</p>
                    <a href="https://nalsa.gov.in/promoting-inclusive-legal-system/" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">Visit NALSA · call 15100 ↗</a>
                </div>
            </div>
        </div>
    )
}
