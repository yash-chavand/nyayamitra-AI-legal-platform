import { useState, useRef, useEffect } from "react"
import { apiPost, apiPut, API } from "../utils/auth"
import ReactMarkdown from "react-markdown"
import RichTextEditor from "./RichTextEditor"

const DOC_TYPES = [
    { key: "police_complaint", icon: "🚔", title: "Police Complaint", desc: "File a formal complaint with police" },
    { key: "consumer_complaint", icon: "🛒", title: "Consumer Complaint", desc: "Under Consumer Protection Act 2019" },
    { key: "rti_application", icon: "📋", title: "RTI Application", desc: "Right to Information Act 2005" },
]

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
    { code: "ur-IN", label: "اردو (Urdu)" }
]

export default function DocumentGenerator() {
    const [docType, setDocType] = useState("")
    const [desc, setDesc] = useState("")
    const [generated, setGenerated] = useState("")
    const [title, setTitle] = useState("")
    const [draftId, setDraftId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState("")
    const [saving, setSaving] = useState(false)

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
            setDesc(startTextRef.current + (startTextRef.current ? " " : "") + currentTranscript)
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

    const handleSaveChanges = async () => {
        if (!draftId) return
        setSaving(true)
        try {
            await apiPut(`/citizen/drafts/${draftId}`, { content: editedContent })
            setGenerated(editedContent)
            setIsEditing(false)
        } catch (err) {
            alert("Failed to save changes: " + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleGenerate = async (e) => {
        e.preventDefault()
        if (!docType) return
        setLoading(true); setError(""); setGenerated("")
        try {
            const data = await apiPost("/citizen/generate-document", {
                doc_type: docType,
                fields: { description: desc }
            })
            setGenerated(data.content)
            setEditedContent(data.content)
            setTitle(data.title || "Document")
            setDraftId(data.draft_id)
            setIsEditing(false)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        const plainText = /<[a-z][\s\S]*>/i.test(generated || "")
            ? generated.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<div>/gi, "").replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "")
            : generated
        navigator.clipboard.writeText(plainText)
    }

    const handleDownload = async () => {
        if (!draftId) return
        try {
            const token = localStorage.getItem("legal_token")
            const res = await fetch(`${API}/citizen/download-docx/${draftId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${title.replace(/\s+/g, '_')}.docx`
            document.body.appendChild(a)
            a.click()
            a.remove()
        } catch (err) {
            console.error("Download failed", err)
        }
    }

    return (
        <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-white mb-2">📄 Document Generator</h2>
            <p className="text-gray-400 text-sm mb-6">AI generates a professional, ready-to-submit legal document from your description.</p>

            {/* Doc type selection */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {DOC_TYPES.map(d => (
                    <button
                        key={d.key}
                        onClick={() => setDocType(d.key)}
                        className={`p-4 rounded-xl border text-left transition-all duration-200
              ${docType === d.key ? "border-primary/50 bg-primary/10" : "card hover:border-gray-600"}`}
                    >
                        <div className="text-2xl mb-2">{d.icon}</div>
                        <div className="text-white font-semibold text-sm">{d.title}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{d.desc}</div>
                    </button>
                ))}
            </div>

            {docType && (
                <form onSubmit={handleGenerate} className="card p-6 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm text-gray-400">
                                Describe your situation in detail
                            </label>
                            {isVoiceSupported && (
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedLanguage}
                                        onChange={(e) => setSelectedLanguage(e.target.value)}
                                        className="bg-surface border border-border text-white text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
                                    >
                                        {LANGUAGES.map(lang => (
                                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={isListening ? () => recognitionRef.current?.stop() : () => {
                                            startTextRef.current = desc
                                            try {
                                                recognitionRef.current?.start()
                                            } catch (e) {
                                                console.error(e)
                                                recognitionRef.current?.stop()
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200
                                            ${isListening 
                                                ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" 
                                                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
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
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder="Explain what happened, when, where, who was involved, what you want to request or complaint about…"
                                rows={5}
                                required
                                className="input resize-none"
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
                        <p className="text-gray-600 text-xs mt-1.5">
                            The more detail you provide, the better the document.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading || !desc.trim()} className="btn-primary w-full flex items-center justify-center gap-2">
                        {loading
                            ? <><div className="spinner" /> Generating document…</>
                            : "✨ Generate Document"}
                    </button>
                </form>
            )}

            {/* Output */}
            {generated && (
                <div className="mt-6 space-y-4 animate-slideInUp">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold">{title}</h3>
                        <div className="flex gap-2">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={handleSaveChanges} 
                                        disabled={saving} 
                                        className="bg-green-500/20 text-green-400 border border-green-400/30 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-green-500/30 transition-all flex items-center gap-1"
                                    >
                                        {saving ? <div className="spinner !w-3 !h-3" /> : "💾 Save Changes"}
                                    </button>
                                    <button 
                                        onClick={() => { setIsEditing(false); setEditedContent(generated) }} 
                                        className="text-gray-400 border border-border hover:bg-surfaceLight px-3.5 py-1.5 rounded-xl text-xs transition-all"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => setIsEditing(true)} 
                                    className="bg-primary/25 text-primary hover:bg-primary/35 border border-primary/45 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    ✏️ Edit Draft
                                </button>
                            )}
                            <button onClick={handleCopy} className="badge-green cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5">
                                📋 Copy
                            </button>
                            <button onClick={handleDownload} className="bg-gold/15 text-gold border border-gold/30 px-3 py-1.5 rounded-full text-xs font-semibold hover:opacity-80 transition-opacity">
                                ⬇️ Download
                            </button>
                        </div>
                    </div>
                    
                    {isEditing ? (
                        <RichTextEditor value={editedContent} onChange={setEditedContent} />
                    ) : (
                        <div 
                            className="card p-6 font-mono text-sm text-gray-200 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto bg-surface/30"
                            dangerouslySetInnerHTML={{
                                __html: /<[a-z][\s\S]*>/i.test(generated || "")
                                    ? generated
                                    : (generated || "").replace(/\n/g, "<br>")
                            }}
                        />
                    )}
                    <p className="text-gray-600 text-xs mt-2 text-center">
                        *This document is AI-generated. Please review before submission.*
                    </p>
                </div>
            )}
        </div>
    )
}
