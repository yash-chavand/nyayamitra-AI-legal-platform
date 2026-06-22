import { useState } from "react"
import { apiGet } from "../utils/auth"

const QUICK_LOOKUPS = [
    { code: "302", old: "302 IPC (Murder)", new: "103(1) BNS" },
    { code: "379", old: "379 IPC (Theft)", new: "303(2) BNS" },
    { code: "420", old: "420 IPC (Cheating)", new: "318(4) BNS" },
    { code: "120B", old: "120B IPC (Conspiracy)", new: "61(2) BNS" },
    { code: "500", old: "500 IPC (Defamation)", new: "356 BNS" },
    { code: "124A", old: "124A IPC (Sedition)", new: "152 BNS" }
]

export default function BNSHelper() {
    const [query, setQuery] = useState("")
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSearch = async (sectionQuery) => {
        const q = sectionQuery || query.trim()
        if (!q) return
        setLoading(true)
        setError("")
        setResult(null)
        try {
            const data = await apiGet(`/citizen/bns-helper?query=${encodeURIComponent(q)}`)
            setResult(data)
        } catch (err) {
            setError(err.message || "Failed to search BNS mapping.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-12 animate-fadeIn">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    ⚖️ BNS Transition Helper
                </h2>
                <p className="text-gray-400 text-sm">
                    Look up and compare old criminal sections (IPC, CrPC, IEA) with the new Indian Penal Codes (BNS, BNSS, BSA) implemented in July 2024.
                </p>
            </div>

            {/* Quick Cards */}
            <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Common Lookups</p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {QUICK_LOOKUPS.map((item) => (
                        <button
                            key={item.code}
                            onClick={() => { setQuery(item.code); handleSearch(item.code) }}
                            className="bg-surfaceLight hover:bg-surface border border-border hover:border-primary/40 rounded-xl py-2 px-3 text-center text-xs transition-all duration-200 cursor-pointer"
                        >
                            <div className="text-white font-semibold mb-1">{item.old}</div>
                            <div className="text-gray-500 text-[10px]">&rarr; {item.new}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Input */}
            <div className="card p-6 mb-8 bg-surface/80 backdrop-blur-md border-border">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSearch() }}
                    className="flex flex-col sm:flex-row gap-3"
                >
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Enter section number or offense name (e.g. 302, theft, defamation)..."
                        className="input flex-1"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary px-8"
                    >
                        {loading ? <div className="spinner" /> : "Compare Sections"}
                    </button>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
                    ⚠️ {error}
                </div>
            )}

            {/* Result Cards */}
            {result && (
                <div className="space-y-6">
                    {/* Offense Card */}
                    <div className="card p-6 border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
                        <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Offense Category</div>
                        <h3 className="text-xl font-bold text-white">{result.offense}</h3>
                    </div>

                    {/* Old vs New Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Old Law Card */}
                        <div className="card p-6 border-gray-800 bg-surface/30">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Old Law</div>
                            <h4 className="text-lg font-bold text-white mb-4">{result.old_section}</h4>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-gray-500 block">Punishment guidelines</span>
                                    <p className="text-sm text-gray-200 mt-0.5 leading-relaxed">{result.old_punishment}</p>
                                </div>
                            </div>
                        </div>

                        {/* New Law Card */}
                        <div className="card p-6 border-primary/20 bg-primary/5">
                            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">New Law (BNS / BNSS / BSA)</div>
                            <h4 className="text-lg font-bold text-white mb-4">{result.new_section}</h4>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-gray-400 block">Punishment guidelines</span>
                                    <p className="text-sm text-gray-200 mt-0.5 leading-relaxed">{result.new_punishment}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Key Differences / Analysis */}
                    <div className="card p-6 space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Key Changes in Definition / Procedure</h4>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{result.changes}</p>
                        </div>
                        <div className="border-t border-border pt-4">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Legal Scholars Analysis</h4>
                            <p className="text-sm text-gray-400 leading-relaxed italic">{result.analysis}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
