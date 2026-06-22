import { useState, useEffect, useRef } from "react"
import { apiPost } from "../utils/auth"
import ReactMarkdown from "react-markdown"

const LANGUAGES = [
    { code: "en-IN", name: "English (India)", native: "English" },
    { code: "hi-IN", name: "Hindi", native: "हिन्दी" },
    { code: "bn-IN", name: "Bengali", native: "বাংলা" },
    { code: "ta-IN", name: "Tamil", native: "தமிழ்" },
    { code: "te-IN", name: "Telugu", native: "తెలుగు" },
    { code: "mr-IN", name: "Marathi", native: "मराठी" },
    { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ" },
    { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
    { code: "ml-IN", name: "Malayalam", native: "മലയാളം" },
    { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "ur-IN", name: "Urdu", native: "اردو" },
    { code: "en-US", name: "English (US)", native: "English (US)" }
]

export default function VoiceAssistant() {
    const [selectedLanguage, setSelectedLanguage] = useState("hi-IN") // default to Hindi
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [translatedQuery, setTranslatedQuery] = useState("")
    const [answer, setAnswer] = useState("")
    const [sources, setSources] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    
    // Voice playback settings
    const [autoSpeak, setAutoSpeak] = useState(true)
    const [handsFree, setHandsFree] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)

    const handsFreeRef = useRef(handsFree)
    const transcriptRef = useRef(transcript)
    const loadingRef = useRef(loading)
    const isListeningRef = useRef(isListening)
    const isPlayingRef = useRef(isPlaying)

    useEffect(() => { handsFreeRef.current = handsFree }, [handsFree])
    useEffect(() => { transcriptRef.current = transcript }, [transcript])
    useEffect(() => { loadingRef.current = loading }, [loading])
    useEffect(() => { isListeningRef.current = isListening }, [isListening])
    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

    // Automatically turn on autoSpeak if handsFree is toggled on
    useEffect(() => {
        if (handsFree) {
            setAutoSpeak(true)
        }
    }, [handsFree])

    const recognitionRef = useRef(null)
    const synthesisUtteranceRef = useRef(null)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const isSupported = !!SpeechRecognition

    // Clean up TTS when leaving component
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel()
        }
    }, [])

    // Initialize/configure Speech Recognition
    useEffect(() => {
        if (!isSupported) return

        const rec = new SpeechRecognition()
        rec.continuous = false
        rec.interimResults = true
        rec.lang = selectedLanguage

        rec.onstart = () => {
            setIsListening(true)
            setTranscript("")
            setAnswer("")
            setSources([])
            setTranslatedQuery("")
            setError("")
            // Stop any ongoing speech playback
            window.speechSynthesis?.cancel()
            setIsPlaying(false)
        }

        rec.onresult = (e) => {
            const currentTranscript = Array.from(e.results)
                .map(result => result[0].transcript)
                .join("")
            setTranscript(currentTranscript)
        }

        rec.onerror = (e) => {
            console.error("Speech recognition error:", e.error)
            if (e.error !== "no-speech") {
                setError(`Speech recognition error: ${e.error}`)
            }
            setIsListening(false)
        }

        rec.onend = () => {
            setIsListening(false)
            if (handsFreeRef.current && !transcriptRef.current && !loadingRef.current) {
                setTimeout(() => {
                    if (!isListeningRef.current && !isPlayingRef.current) {
                        try {
                            recognitionRef.current?.start()
                        } catch (err) {
                            console.error("Auto-restart listening failed:", err)
                        }
                    }
                }, 1000)
            }
        }

        recognitionRef.current = rec
    }, [selectedLanguage, isSupported])

    // Automatically send query when speech ends (if there's a transcript)
    useEffect(() => {
        if (!isListening && transcript.trim() && !loading && !answer) {
            handleSendQuery(transcript)
        }
    }, [isListening])

    const startListening = () => {
        if (!isSupported) return
        try {
            recognitionRef.current?.start()
        } catch (e) {
            console.error(e)
            recognitionRef.current?.stop()
        }
    }

    const stopListening = () => {
        recognitionRef.current?.stop()
    }

    const handleSendQuery = async (queryText) => {
        const query = queryText || transcript.trim()
        if (!query) return

        setLoading(true)
        setError("")
        
        // Find corresponding language name for the backend
        const langObj = LANGUAGES.find(l => l.code === selectedLanguage)
        const targetLanguageName = langObj ? langObj.name : "English"

        try {
            const response = await apiPost("/citizen/ask", {
                question: query,
                language: targetLanguageName
            })

            setAnswer(response.answer)
            setSources(response.sources || [])
            if (response.translated_query) {
                setTranslatedQuery(response.translated_query)
            }

            if (autoSpeak && response.answer) {
                speakText(response.answer)
            }
        } catch (err) {
            setError(err.message || "Failed to query Legal AI. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    // Play Response Speech
    const speakText = (text) => {
        if (!window.speechSynthesis) return

        window.speechSynthesis.cancel() // Stop any current speech
        
        // Strip markdown before speaking for a cleaner audio output
        const cleanText = text.replace(/[*#_`~[\]()]/g, "")
        
        const utterance = new SpeechSynthesisUtterance(cleanText)
        
        // Try to match the selected language
        utterance.lang = selectedLanguage
        
        // Find suitable voice in the browser
        const voices = window.speechSynthesis.getVoices()
        // Try to find a voice that exactly matches the language code (e.g. hi-IN)
        let voice = voices.find(v => v.lang.toLowerCase() === selectedLanguage.toLowerCase())
        if (!voice) {
            // Fallback: match by general prefix (e.g. "hi", "ta", etc.)
            const prefix = selectedLanguage.split("-")[0].toLowerCase()
            voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix))
        }
        if (voice) {
            utterance.voice = voice
        }

        utterance.onstart = () => setIsPlaying(true)
        utterance.onend = () => {
            setIsPlaying(false)
            if (handsFreeRef.current) {
                setTimeout(() => {
                    if (!isListeningRef.current) {
                        try {
                            recognitionRef.current?.start()
                        } catch (err) {
                            console.error("Auto-restart listening failed:", err)
                        }
                    }
                }, 600)
            }
        }
        utterance.onerror = () => {
            setIsPlaying(false)
            if (handsFreeRef.current) {
                setTimeout(() => {
                    if (!isListeningRef.current) {
                        try {
                            recognitionRef.current?.start()
                        } catch (err) {
                            console.error("Auto-restart listening failed:", err)
                        }
                    }
                }, 600)
            }
        }

        synthesisUtteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }

    const stopSpeaking = () => {
        window.speechSynthesis?.cancel()
        setIsPlaying(false)
    }

    const handleCopy = () => {
        if (answer) {
            navigator.clipboard.writeText(answer)
        }
    }

    if (!isSupported) {
        return (
            <div className="card p-8 text-center max-w-2xl mx-auto mt-10">
                <div className="text-5xl mb-4">🎙️</div>
                <h3 className="text-xl font-bold text-white mb-2">Speech Recognition Not Supported</h3>
                <p className="text-gray-400 text-sm">
                    Your current browser does not support the Web Speech API. 
                    Please try using modern browsers like <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Apple Safari</strong>.
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto pb-12">
            {/* Header */}
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                    🎙️ Multilingual Voice Assistant
                </h2>
                <p className="text-gray-400 text-sm">
                    Speak your question in your preferred language to receive Indian legal assistance.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ── Left Control Panel ──────────────────── */}
                <div className="card p-6 space-y-6 flex flex-col justify-between">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Select Language
                        </label>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => {
                                setSelectedLanguage(e.target.value)
                                stopSpeaking()
                                setTranscript("")
                                setAnswer("")
                            }}
                            className="w-full bg-surfaceLight border border-border text-white rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all cursor-pointer"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.native} ({lang.name})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Microphone Section */}
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="relative flex items-center justify-center">
                            {/* concentric ripple effect */}
                            {isListening && (
                                <>
                                    <div className="absolute w-24 h-24 bg-primary/20 rounded-full animate-ping" />
                                    <div className="absolute w-32 h-32 bg-primary/10 rounded-full animate-pulse" />
                                </>
                            )}
                            
                            <button
                                onClick={isListening ? stopListening : startListening}
                                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-300 focus:outline-none z-10 shadow-glow
                                    ${isListening 
                                        ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-red-500/25" 
                                        : "bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                                    }`}
                                title={isListening ? "Stop Listening" : "Start Speaking"}
                            >
                                {isListening ? "🛑" : "🎙️"}
                            </button>
                        </div>
                        
                        <p className={`mt-4 text-sm font-semibold tracking-wide uppercase transition-colors duration-200
                            ${isListening ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
                            {isListening ? "Listening... Speak Now" : "Tap Mic to Start"}
                        </p>
                    </div>

                    {/* Speech Playback Toggle */}
                    <div className="border-t border-border pt-4 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={autoSpeak}
                                onChange={(e) => setAutoSpeak(e.target.checked)}
                                className="w-4 h-4 rounded border-border bg-surfaceLight text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <div className="text-sm">
                                <p className="text-white font-medium">Auto-Speak Response</p>
                                <p className="text-gray-500 text-xs">Read out AI responses automatically</p>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={handsFree}
                                onChange={(e) => setHandsFree(e.target.checked)}
                                className="w-4 h-4 rounded border-border bg-surfaceLight text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <div className="text-sm">
                                <p className="text-white font-medium">🙌 Hands-Free Loop</p>
                                <p className="text-gray-500 text-xs">Automatically listen after assistant speaks</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* ── Right Content Panel ─────────────────── */}
                <div className="md:col-span-2 card p-6 space-y-6 flex flex-col min-h-[420px]">
                    {/* Live Transcript / Input Display */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                    Spoken Query
                                </h3>
                                {transcript && (
                                    <button 
                                        onClick={() => { setTranscript(""); setAnswer(""); setSources([]); setTranslatedQuery("") }}
                                        className="text-xs text-gray-500 hover:text-white transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            
                            <div className="bg-surfaceLight/50 border border-border rounded-xl p-4 min-h-[80px] max-h-[140px] overflow-y-auto text-sm text-gray-200 leading-relaxed italic">
                                {transcript || (
                                    <span className="text-gray-600 not-italic">
                                        Your voice query will appear here in real-time...
                                    </span>
                                )}
                            </div>
                            
                            {/* Listening Simulated Waveform */}
                            {isListening && (
                                <div className="flex items-center justify-center gap-1 mt-3 h-6">
                                    {[...Array(9)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className="w-1 bg-primary/70 rounded-full animate-bounce"
                                            style={{ 
                                                animationDuration: `${0.6 + (i % 3) * 0.2}s`, 
                                                animationDelay: `${i * 0.1}s`,
                                                height: `${Math.max(4, (i % 4) * 5 + 4)}px`
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* English Translation sub-box */}
                            {translatedQuery && (
                                <div className="mt-3 text-xs text-gray-400 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 flex gap-1.5 items-center">
                                    <span className="font-semibold text-primary">🔍 Translated for search:</span>
                                    <span>"{translatedQuery}"</span>
                                </div>
                            )}
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div className="mt-4 bg-red-500/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Answer Output */}
                        <div className="mt-6 border-t border-border pt-6 flex-1 flex flex-col justify-start">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                    AI Response
                                </h3>
                                {answer && (
                                    <div className="flex gap-2">
                                        {isPlaying ? (
                                            <button 
                                                onClick={stopSpeaking}
                                                className="bg-red-500/15 text-red-400 border border-red-400/30 px-3 py-1 rounded-full text-xs font-semibold hover:bg-red-500/20 transition-all flex items-center gap-1"
                                            >
                                                ⏹️ Mute
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => speakText(answer)}
                                                className="bg-primary/15 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                                            >
                                                🔊 Play
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleCopy}
                                            className="badge-green cursor-pointer hover:opacity-80 transition-opacity px-3 py-1 flex items-center gap-1"
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[300px] text-sm text-gray-200 leading-relaxed pr-1">
                                {loading ? (
                                    <div className="flex items-center gap-3 py-4">
                                        <div className="spinner" />
                                        <span className="text-gray-400 text-sm">Consulting AI Knowledge Base...</span>
                                    </div>
                                ) : answer ? (
                                    <div className="prose prose-invert max-w-none">
                                        <ReactMarkdown>{answer}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-gray-600 italic">
                                        AI output will be displayed here. Tap the mic and describe your query.
                                    </p>
                                )}
                            </div>

                            {/* Sources display */}
                            {sources.length > 0 && (
                                <div className="mt-4 border-t border-border pt-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        Sources Found
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {sources.map((src, j) => (
                                            <div key={j} className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-xs">
                                                <div className="text-primary font-semibold truncate" title={src.law}>{src.law}</div>
                                                <div className="text-gray-500">Page {src.page}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
