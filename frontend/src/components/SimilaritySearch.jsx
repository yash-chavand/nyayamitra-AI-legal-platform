import { useState, useRef, useEffect } from "react"
import { apiPost, BASE_URL } from "../utils/auth"
import ReactMarkdown from "react-markdown"

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

function CaseSpecificChat({ caseName, onClose }) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        if (!input.trim()) return
        const userMsg = { role: "user", content: input }
        setMessages(prev => [...prev, userMsg])
        setInput("")
        setLoading(true)
        try {
            const data = await apiPost("/lawyer/ask-case", { question: input, case_name: caseName })
            setMessages(prev => [...prev, { role: "assistant", content: data.answer }])
        } catch (err) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-gold/30 w-full max-w-2xl rounded-2xl h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-gold/20 flex justify-between items-center bg-gold/5">
                    <h3 className="text-gold font-bold truncate pr-4">Chat about: {caseName}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-gold text-black rounded-tr-none' : 'bg-surfaceLight text-gray-200 border border-border rounded-tl-none'}`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {loading && <div className="spinner-gold self-center mx-auto" />}
                    {messages.length === 0 && <p className="text-center text-gray-500 mt-10">Ask any deep question about this judgment...</p>}
                </div>
                <div className="p-4 border-t border-border bg-surfaceLight">
                    <div className="flex gap-2">
                        <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ask specific questions about this case..." className="input-gold flex-1 text-sm bg-bg" />
                        <button onClick={handleSend} disabled={loading} className="btn-gold px-4">📩</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CaseCard({ c, index, onChat }) {
    const [expanded, setExpanded] = useState(false)
    const pct = Math.round(c.similarity * 100)
    const barColor = pct > 70 ? "bg-green-400" : pct > 40 ? "bg-yellow-400" : "bg-red-400"

    return (
        <div className="card-gold p-5">
            <div className="flex justify-between items-start mb-3 gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-gold font-bold text-sm">#{index + 1}</span>
                        <span className="badge-criminal">{c.case_type || "Criminal"}</span>
                        {c.year && <span className="text-gray-500 text-xs">{c.year}</span>}
                    </div>
                    <h3 className="text-white font-semibold text-sm leading-snug">{c.case_name}</h3>
                </div>
                <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-400 mb-1">Similarity</div>
                    <div className="text-lg font-bold text-white">{pct}%</div>
                    <div className="w-16 h-1.5 bg-border rounded-full mt-1">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                </div>
            </div>

            <p className={`text-gray-400 text-xs leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                {c.excerpt}
            </p>
            <button onClick={() => setExpanded(!expanded)} className="text-gold text-xs mt-1 hover:opacity-80 transition-opacity">
                {expanded ? "Show less ▲" : "Read more ▼"}
            </button>

            <div className="flex gap-3 mt-4">
                <button onClick={() => onChat(c.case_name)} className="flex-1 bg-gold/10 text-gold border border-gold/30 py-1.5 rounded-lg text-xs font-semibold hover:bg-gold/20 transition-all flex items-center justify-center gap-1.5">
                    🧠 Analyze Deeply
                </button>
                {c.link ? (
                    <a href={c.link.startsWith("http") ? c.link : `${BASE_URL}${c.link}`} target="_blank" rel="noreferrer" className="flex-1 border border-border text-gray-400 py-1.5 rounded-lg text-xs font-semibold hover:border-gold/40 hover:text-white transition-all text-center">
                        📄 View PDF
                    </a>
                ) : c.pdf_path && (
                    <a href={`${BASE_URL}/data/judgments/${c.pdf_path.split(/[/\\]/).pop()}`} target="_blank" rel="noreferrer" className="flex-1 border border-border text-gray-400 py-1.5 rounded-lg text-xs font-semibold hover:border-gold/40 hover:text-white transition-all text-center">
                        📄 View PDF
                    </a>
                )}
            </div>
        </div>
    )
}

export default function SimilaritySearch() {
    const [query, setQuery] = useState("")
    const [k, setK] = useState(5)
    const [results, setResults] = useState(null)
    const [strategy, setStrategy] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [activeChat, setActiveChat] = useState(null)
    const [showCases, setShowCases] = useState(false)

    const [isListening, setIsListening] = useState(false)
    const [selectedLanguage, setSelectedLanguage] = useState("hi-IN")
    const [translatedQuery, setTranslatedQuery] = useState("")
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
            setQuery(startTextRef.current + (startTextRef.current ? " " : "") + currentTranscript)
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

    const getLanguageName = (code) => {
        const names = {
            "hi-IN": "Hindi",
            "en-IN": "English",
            "bn-IN": "Bengali",
            "ta-IN": "Tamil",
            "te-IN": "Telugu",
            "mr-IN": "Marathi",
            "kn-IN": "Kannada",
            "gu-IN": "Gujarati",
            "ml-IN": "Malayalam",
            "pa-IN": "Punjabi",
            "ur-IN": "Urdu"
        }
        return names[code] || "English"
    }

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!query.trim()) return
        setLoading(true); setError(""); setResults(null); setStrategy(""); setShowCases(false); setTranslatedQuery("")
        try {
            const data = await apiPost("/lawyer/similar-cases", { 
                query, 
                k, 
                include_strategy: true,
                language: getLanguageName(selectedLanguage)
            })
            setResults(data.cases)
            setStrategy(data.strategy || "")
            if (data.translated_query) {
                setTranslatedQuery(data.translated_query)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            {activeChat && <CaseSpecificChat caseName={activeChat} onClose={() => setActiveChat(null)} />}

            <h2 className="text-xl font-bold text-white mb-2">🔍 Case Similarity Search</h2>
            <p className="text-gray-400 text-sm mb-6">
                Describe your case. AI will analyze it to provide a litigation strategy and research supporting precedents.
            </p>

            <form onSubmit={handleSearch} className="card p-6 space-y-4 mb-8">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-gray-400 font-medium">Describe your legal case</label>
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
                                        startTextRef.current = query
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
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="e.g. My client is accused of robbery under IPC 392. Fir states gold chain snatching. Need similar acquittals..."
                            rows={4}
                            required
                            className="input-gold resize-none"
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
                    {/* Translated Query Sub-box */}
                    {translatedQuery && (
                        <div className="mt-2 text-xs text-gold/80 bg-gold/5 border border-gold/10 rounded-lg px-3 py-2 flex gap-1.5 items-center animate-fadeIn">
                            <span className="font-semibold text-gold">🔍 Translated Search Term:</span>
                            <span>"{translatedQuery}"</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">Top results:</label>
                        <select value={k} onChange={e => setK(Number(e.target.value))} className="bg-surfaceLight border border-border text-white rounded-lg px-3 py-1.5 text-sm">
                            {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <button type="submit" disabled={loading || !query.trim()} className="btn-gold flex items-center gap-2 ml-auto px-6">
                        {loading ? <><div className="spinner-gold" /> Searching…</> : "🔍 Generate Strategy"}
                    </button>
                </div>
                {error && <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
            </form>

            {strategy && (
                <div className="space-y-6">
                    <div className="card-gold p-8 border-gold/40 animate-fadeIn">
                        <div className="flex justify-between items-center mb-6 border-b border-gold/20 pb-4">
                            <h3 className="text-gold font-bold text-lg">🧠 AI Advanced Litigation Strategy</h3>
                            {results && (
                                <button
                                    onClick={() => setShowCases(!showCases)}
                                    className="text-xs text-gray-400 hover:text-gold transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-gold/30"
                                >
                                    {showCases ? "Hide Precedents ▲" : `View ${results.length} Supporting Cases ▼`}
                                </button>
                            )}
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed space-y-4">
                            <ReactMarkdown>{strategy}</ReactMarkdown>
                        </div>
                    </div>

                    {showCases && results && (
                        <div className="animate-slideDown">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2 px-1">
                                📊 Supporting Case Precedents
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4 mb-8">
                                {results.map((c, i) => <CaseCard key={i} c={c} index={i} onChat={setActiveChat} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!strategy && !loading && (
                <div className="text-center py-16 text-gray-600">
                    <div className="text-5xl mb-4 opacity-50">🏛️</div>
                    <p>Enter your case details above to generate a professional litigation strategy.</p>
                </div>
            )}
        </div>
    )
}
