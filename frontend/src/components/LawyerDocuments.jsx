import { useState, useEffect, useRef } from "react"
import { apiPost, apiGet, apiPut, API } from "../utils/auth"
import RichTextEditor from "./RichTextEditor"

const LANGUAGES = [
    { code: "hi-IN", label: "हिन्दी (Hindi)" },
    { code: "en-IN", label: "English (India)" },
    { code: "bn-IN", label: "বাংলা (Bengali)" },
    { code: "ta-IN", label: "தமிழ் (Tamil)" },
    { code: "te-IN", label: "తెలుగు (Telugu)" },
    { code: "mr-IN", label: "मराठी (Marathi)" },
    { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
    { code: "gu-IN", label: "ગુજરાતી (Gujarati)" },
    { code: "ml-IN", label: "മലയാളം (Malayalam)" },
    { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
    { code: "ur-IN", label: "Urdu (Urdu)" }
]

export default function LawyerDocuments() {
    const [docs, setDocs] = useState([])
    const [activeType, setActiveType] = useState(null)
    const [formData, setFormData] = useState({ case_title: "", details: "" })
    const [generating, setGenerating] = useState(false)
    const [result, setResult] = useState(null)
    const [loadingHistory, setLoadingHistory] = useState(true)
    
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (result) {
            setEditedContent(result.content)
            setIsEditing(false)
        }
    }, [result])

    const [isListening, setIsListening] = useState(false)
    const [selectedLanguage, setSelectedLanguage] = useState("hi-IN")
    const recognitionRef = useRef(null)
    const startTextRef = useRef("")
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const isVoiceSupported = !!SpeechRecognition

    useEffect(() => {
        if (!isVoiceSupported) return

        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = selectedLanguage

        rec.onstart = () => {
            setIsListening(true)
        }

        rec.onresult = (e) => {
            const currentTranscript = Array.from(e.results)
                .map(result => result[0].transcript)
                .join("")
            setFormData(prev => ({
                ...prev,
                details: startTextRef.current + (startTextRef.current ? " " : "") + currentTranscript
            }))
        }

        rec.onerror = (e) => {
            console.error("Speech recognition error:", e.error)
            setIsListening(false)
        }

        rec.onend = () => {
            setIsListening(false)
        }

        recognitionRef.current = rec

        return () => {
            rec.stop()
        }
    }, [selectedLanguage, isVoiceSupported])

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        setLoadingHistory(true)
        try {
            const data = await apiGet("/lawyer/documents")
            setDocs(data)
        } catch (err) {
            console.error("Failed to fetch documents", err)
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleGenerate = async (e) => {
        e.preventDefault()
        setGenerating(true)
        setResult(null)
        try {
            const endpoint = `/lawyer/documents/generate-${activeType.replace("_", "-")}`
            const data = await apiPost(endpoint, formData)
            setResult(data)
            fetchHistory()
        } catch (err) {
            alert("Generation failed: " + err.message)
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveChanges = async () => {
        if (!result) return
        setSaving(true)
        try {
            await apiPut(`/lawyer/documents/${result.id}`, { content: editedContent })
            setResult(prev => ({ ...prev, content: editedContent }))
            setDocs(prev => prev.map(d => d.id === result.id ? { ...d, content: editedContent } : d))
            setIsEditing(false)
        } catch (err) {
            alert("Failed to save changes: " + err.message)
        } finally {
            setSaving(false)
        }
    }

    const downloadPDF = async (doc) => {
        try {
            const response = await fetch(`${API}/lawyer/documents/export-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("legal_token")}`
                },
                body: JSON.stringify({ content: doc.content, title: doc.case_title })
            })
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${doc.case_title.replace(/\s+/g, '_')}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
        } catch (err) {
            alert("Download failed")
        }
    }

    const DOC_TYPES = [
        { id: "bail", label: "Bail Application", icon: "🔓", color: "from-blue-500/20 to-blue-600/5", border: "border-blue-500/30" },
        { id: "legal_notice", label: "Legal Notice", icon: "✉️", color: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/30" },
        { id: "written_arguments", label: "Written Arguments", icon: "📝", color: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/30" }
    ]

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">📂 Litigation Document Generator</h2>
                    <p className="text-gray-400 text-sm mt-1">Select a document type to generate professional court-ready drafts.</p>
                </div>
            </header>

            {/* Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {DOC_TYPES.map(type => (
                    <button
                        key={type.id}
                        onClick={() => { setActiveType(type.id); setResult(null); setFormData({ case_title: "", details: "" }) }}
                        className={`group relative overflow-hidden card p-5 text-left transition-all duration-300 hover:scale-[1.02] border-2 ${activeType === type.id ? 'border-gold bg-gold/5 shadow-goldglow' : 'border-transparent hover:border-gold/30'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-4xl bg-surfaceLight w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-gold/10 transition-colors shadow-inner">
                                {type.icon}
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base leading-tight">{type.label}</h3>
                                <p className="text-gray-500 text-[10px] uppercase mt-1 tracking-widest font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gold/50"></span> Interactive Template
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-8 items-start">
                {/* Left Side: Form & History */}
                <div className="w-full xl:w-[45%] space-y-8">
                    {/* Form Card */}
                    {activeType ? (
                        <div className="card p-6 border-gold/20 bg-surface/80 backdrop-blur-md shadow-2xl animate-slideInLeft">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                                <h3 className="text-gold font-bold text-lg flex items-center gap-2">
                                    🖋️ Create {DOC_TYPES.find(t => t.id === activeType)?.label}
                                </h3>
                                <div className="text-[10px] text-gray-500 bg-surfaceLight px-2 py-1 rounded-full border border-border">
                                    AI-POWERED DRAFTING
                                </div>
                            </div>
                            <form onSubmit={handleGenerate} className="space-y-6">
                                <div>
                                    <label className="text-[11px] text-gray-400 uppercase tracking-widest mb-2 block font-bold">Case Title / Reference</label>
                                    <input
                                        required
                                        value={formData.case_title}
                                        onChange={e => setFormData({ ...formData, case_title: e.target.value })}
                                        placeholder="e.g. State vs. John Doe - FIR No. 112/2024"
                                        className="input-gold text-sm py-3 px-4 bg-bg/50"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] text-gray-400 uppercase tracking-widest block font-bold">Case Details & Specific Facts</label>
                                        {isVoiceSupported && (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={selectedLanguage}
                                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                                    className="bg-surface border border-border text-white text-[10px] rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                                                >
                                                    {LANGUAGES.map(lang => (
                                                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={isListening ? () => recognitionRef.current?.stop() : () => {
                                                        startTextRef.current = formData.details
                                                        try {
                                                            recognitionRef.current?.start()
                                                        } catch (e) {
                                                            console.error(e)
                                                            recognitionRef.current?.stop()
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all duration-200
                                                        ${isListening 
                                                            ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" 
                                                            : "bg-gold/10 border-gold/30 text-gold hover:bg-gold/20"
                                                        }`}
                                                >
                                                    <span>{isListening ? "🛑 Stop Mic" : "🎙️ Dictate"}</span>
                                                    {isListening && <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            required
                                            rows={10}
                                            value={formData.details}
                                            onChange={e => setFormData({ ...formData, details: e.target.value })}
                                            placeholder={`Enter case facts, prayer details, or specific requirements for the ${activeType.replace('_', ' ')}...`}
                                            className="input-gold text-sm py-4 px-4 bg-bg/50 resize-none h-48 leading-relaxed"
                                        />
                                        {/* Listening visualizer indicator inside textarea */}
                                        {isListening && (
                                            <div className="absolute right-3 bottom-3 flex items-center gap-0.5 h-6 bg-surfaceLight/80 px-2 py-1 rounded border border-border">
                                                <span className="text-[10px] text-red-400 uppercase tracking-wider mr-1 animate-pulse">Recording</span>
                                                {[...Array(4)].map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="w-0.5 bg-red-400 rounded-full animate-bounce"
                                                        style={{ 
                                                            animationDuration: `${0.5 + (i % 2) * 0.2}s`, 
                                                            animationDelay: `${i * 0.1}s`,
                                                            height: `${Math.max(4, (i % 3) * 3 + 4)}px`
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button type="submit" disabled={generating} className="btn-gold w-full py-4 text-base shadow-goldglow hover:shadow-goldglow-lg transition-all active:scale-[0.98]">
                                    {generating ? <span className="flex items-center justify-center gap-2"><div className="spinner-gold !border-black" /> Generating Document...</span> : "🚀 Craft Professional Draft"}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="card p-16 text-center border-dashed border-gray-800 text-gray-500 bg-surface/30">
                            <div className="text-6xl mb-6 opacity-10">📜</div>
                            <h4 className="text-lg font-medium text-gray-400">Ready to draft?</h4>
                            <p className="text-sm mt-2 max-w-sm mx-auto">Select a document type from the cards above to start generating a professional legal draft.</p>
                        </div>
                    )}

                    {/* History Section - Distinct with spacing */}
                    <div className="card p-6 bg-surface/50 border-border/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                📂 History & Recent Saved Drafts
                            </h3>
                            <button onClick={fetchHistory} className="text-[10px] text-gold hover:underline">REFRESH</button>
                        </div>
                        {loadingHistory ? (
                            <div className="flex justify-center p-8"><div className="spinner-gold" /></div>
                        ) : docs.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {docs.map(doc => (
                                    <div key={doc.id} className="p-4 bg-bg/40 border border-border/50 rounded-xl flex items-center justify-between hover:border-gold/40 transition-all group hover:bg-surfaceLight/30">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <div className="text-white font-semibold text-sm truncate group-hover:text-gold transition-colors">{doc.case_title}</div>
                                            <div className="text-[10px] text-gray-500 uppercase flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded ${doc.document_type === 'bail' ? 'bg-blue-500/10 text-blue-400' : doc.document_type === 'legal_notice' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                    {doc.document_type.replace('_', ' ')}
                                                </span>
                                                <span className="opacity-30">•</span>
                                                <span>{new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setResult(doc); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="w-8 h-8 flex items-center justify-center bg-surfaceLight hover:bg-gold/20 text-gold rounded-lg transition-colors" title="View">👁️</button>
                                            <button onClick={() => downloadPDF(doc)} className="w-8 h-8 flex items-center justify-center bg-surfaceLight hover:bg-gold/20 text-gold rounded-lg transition-colors" title="Download">⬇️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-600">
                                <p className="text-sm italic">No history found.</p>
                                <p className="text-[10px] mt-1 uppercase tracking-widest">Everything you generate will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Result Preview */}
                <div className="w-full xl:w-[55%] min-h-[500px]">
                    {result ? (
                        <div className="card p-0 border-gold shadow-goldglow-lg overflow-hidden flex flex-col h-full sticky top-8 animate-fadeIn">
                            <div className="p-5 bg-gold/10 border-b border-gold/20 flex justify-between items-center backdrop-blur-sm flex-wrap gap-3">
                                <div>
                                    <h4 className="text-gold font-bold text-sm tracking-wide">{result.case_title}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gold/60 uppercase font-black tracking-widest">{result.document_type.replace('_', ' ')}</span>
                                        <span className="w-1 h-1 rounded-full bg-gold/30"></span>
                                        <span className="text-[10px] text-gold/40">FINAL AI-GENERATED DRAFT</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={handleSaveChanges}
                                                disabled={saving}
                                                className="bg-green-500/20 text-green-400 border border-green-400/30 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-green-500/30 transition-all flex items-center gap-1"
                                            >
                                                {saving ? <div className="spinner !w-3 !h-3" /> : "💾 Save"}
                                            </button>
                                            <button
                                                onClick={() => { setIsEditing(false); setEditedContent(result.content) }}
                                                className="text-gray-400 border border-border hover:bg-surfaceLight px-3.5 py-1.5 rounded-xl text-xs transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="bg-gold/15 text-gold border border-gold/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
                                        >
                                            ✏️ Edit Draft
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            const plainText = /<[a-z][\s\S]*>/i.test(result.content || "")
                                                ? result.content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<div>/gi, "").replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "")
                                                : result.content
                                            navigator.clipboard.writeText(plainText)
                                            alert("Copied to clipboard!")
                                        }}
                                        className="btn-glass px-4 py-2"
                                    >
                                        📋 Copy Text
                                    </button>
                                    <button
                                        onClick={() => downloadPDF(result)}
                                        className="btn-gold px-4 py-2 hover:scale-105"
                                    >
                                        ⬇️ Download PDF
                                    </button>
                                </div>
                            </div>
                            {isEditing ? (
                                <div className="flex-1 p-6 bg-surface/30 overflow-y-auto min-h-[400px]">
                                    <RichTextEditor value={editedContent} onChange={setEditedContent} />
                                </div>
                            ) : (
                                <div className="flex-1 p-12 bg-white text-black overflow-y-auto font-serif text-base leading-[1.8] whitespace-pre-wrap selection:bg-gold/30">
                                    <div 
                                        className="max-w-[700px] mx-auto shadow-sm"
                                        dangerouslySetInnerHTML={{
                                            __html: /<[a-z][\s\S]*>/i.test(result.content || "")
                                                ? result.content
                                                : (result.content || "").replace(/\n/g, "<br>")
                                        }}
                                    />
                                </div>
                            )}
                            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                                Private & Confidential • Prepared for Legal Consultation
                            </div>
                        </div>
                    ) : (
                        <div className="card p-20 text-center border-dashed border-gray-800 text-gray-600 h-full flex flex-col justify-center bg-surface/20 min-h-[800px]">
                            <div className="relative inline-block mx-auto mb-8">
                                <div className="text-8xl opacity-10 grayscale scale-x-[-1]">📜</div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="spinner-gold opacity-30 w-16 h-16" />
                                </div>
                            </div>
                            <h4 className="text-xl font-bold text-gray-500">Document Preview</h4>
                            <p className="max-w-xs mx-auto text-sm text-gray-600 mt-4 leading-relaxed">
                                Once you generate a draft, the fully formatted, court-ready document will appear here for review and download.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-2 opacity-30 grayscale">
                                <span className="px-3 py-1 bg-surface rounded-full text-[10px] border border-border">PDF SUPPORT</span>
                                <span className="px-3 py-1 bg-surface rounded-full text-[10px] border border-border">COURT FORMATS</span>
                                <span className="px-3 py-1 bg-surface rounded-full text-[10px] border border-border">HISTORY SYNC</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
