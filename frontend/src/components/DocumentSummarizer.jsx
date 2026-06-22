import { useState } from "react"
import { API } from "../utils/auth"

export default function DocumentSummarizer() {
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [summary, setSummary] = useState(null)

    const handleFileChange = (e) => {
        setError("")
        const selectedFile = e.target.files[0]
        if (selectedFile && selectedFile.type !== "application/pdf") {
            setError("Please upload a PDF file.")
            setFile(null)
            return
        }
        setFile(selectedFile)
    }

    const handleUpload = async (e) => {
        e.preventDefault()
        if (!file) return
        setLoading(true)
        setError("")
        setSummary(null)

        const formData = new FormData()
        formData.append("file", file)

        try {
            const token = localStorage.getItem("legal_token")
            const response = await fetch(`${API}/lawyer/summarize-document`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || "Failed to summarize document.")
            }

            const data = await response.json()
            setSummary(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">📄 Legal PDF Summarizer</h2>
                <p className="text-gray-400 text-sm mt-1">Upload a judgment or petition PDF to extract key findings, citations, holding, and arguments.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Upload Form */}
                <div className="w-full lg:w-[35%] space-y-4">
                    <form onSubmit={handleUpload} className="card p-6 border-gold/20 bg-surface/80 backdrop-blur-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                            <h3 className="text-gold font-bold text-sm">
                                Upload Document
                            </h3>
                            <div className="text-[9px] text-gray-500 bg-surfaceLight px-2 py-0.5 rounded-full border border-border">
                                PDF ONLY
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-border hover:border-gold/40 rounded-2xl p-6 transition-all text-center cursor-pointer relative bg-bg/20">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                <div className="text-3xl mb-2">📥</div>
                                <div className="text-xs text-gray-300 font-semibold truncate">
                                    {file ? file.name : "Select PDF Document"}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Drag & drop or browse"}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-3.5 py-2 text-red-400 text-xs">
                                    ⚠️ {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !file}
                                className="btn-gold w-full py-3 text-xs shadow-goldglow hover:shadow-goldglow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="spinner-gold !border-black" /> Processing PDF...
                                    </span>
                                ) : "🚀 Extract & Summarize"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Summary View */}
                <div className="w-full lg:w-[65%] min-h-[400px]">
                    {summary ? (
                        <div className="card p-6 border-gold bg-surface/40 backdrop-blur-md shadow-soft animate-slideInRight space-y-6">
                            {/* Case Title / Header */}
                            <div className="pb-4 border-b border-border">
                                <h3 className="text-gold font-bold text-lg mb-1 leading-snug">
                                    {summary.case_title}
                                </h3>
                                <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <span>🏛️</span>
                                        <span className="font-semibold text-gray-300">{summary.court_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>📅</span>
                                        <span>{summary.date_of_judgment}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Case Summary */}
                            <div className="space-y-2">
                                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Case Summary</h4>
                                <p className="text-sm text-gray-200 leading-relaxed bg-bg/30 p-4 rounded-xl border border-border/50">
                                    {summary.case_summary}
                                </p>
                            </div>

                            {/* Core Holding */}
                            <div className="space-y-2">
                                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Core Legal Holding</h4>
                                <p className="text-sm text-yellow-400/90 leading-relaxed bg-yellow-400/5 p-4 rounded-xl border border-yellow-400/10">
                                    ⚖️ {summary.holding}
                                </p>
                            </div>

                            {/* Opposing Arguments */}
                            <div className="space-y-2">
                                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Counter / Opposing Arguments</h4>
                                <p className="text-sm text-red-400/90 leading-relaxed bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                                    🛡️ {summary.counter_arguments}
                                </p>
                            </div>

                            {/* Key Citations */}
                            <div className="space-y-2">
                                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Key Citations & Cited Laws</h4>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {summary.key_citations && summary.key_citations.length > 0 ? (
                                        summary.key_citations.map((cit, idx) => (
                                            <span key={idx} className="bg-surfaceLight border border-border px-3 py-1 rounded-full text-xs text-gray-300 hover:border-gold/30 hover:text-white transition-colors cursor-default">
                                                🔖 {cit}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-500 italic">No citations found.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card p-20 text-center border-dashed border-gray-800 text-gray-600 h-full flex flex-col justify-center bg-surface/20 min-h-[400px]">
                            <div className="text-6xl mb-4 opacity-10">📄</div>
                            <h4 className="text-lg font-bold text-gray-500">Summary & Citations</h4>
                            <p className="max-w-xs mx-auto text-xs text-gray-600 mt-2 leading-relaxed">
                                Upload a legal document PDF to see a structured extraction of citations, holdings, arguments, and key case facts.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
