import { useState, useEffect } from "react"
import { apiGet, apiPost, apiPut, apiDelete } from "../utils/auth"

export default function HearingScheduler() {
    const [hearings, setHearings] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ case_title: "", hearing_date: "", bench: "", stage: "", notes: "" })
    const [editingId, setEditingId] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        fetchHearings()
    }, [])

    const fetchHearings = async () => {
        setLoading(true)
        try {
            const data = await apiGet("/lawyer/hearings")
            setHearings(data)
        } catch (err) {
            console.error("Failed to fetch hearings:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.case_title || !form.hearing_date) {
            setError("Case Title and Hearing Date are required.")
            return
        }
        setSaving(true)
        setError("")
        try {
            if (editingId) {
                const updated = await apiPut(`/lawyer/hearings/${editingId}`, form)
                setHearings(prev => prev.map(h => h.id === editingId ? updated : h))
                setEditingId(null)
            } else {
                const created = await apiPost("/lawyer/hearings", form)
                setHearings(prev => [...prev, created].sort((a, b) => new Date(a.hearing_date) - new Date(b.hearing_date)))
            }
            setForm({ case_title: "", hearing_date: "", bench: "", stage: "", notes: "" })
        } catch (err) {
            setError(err.message || "Operation failed")
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (hearing) => {
        setEditingId(hearing.id)
        setForm({
            case_title: hearing.case_title,
            hearing_date: hearing.hearing_date,
            bench: hearing.bench || "",
            stage: hearing.stage || "",
            notes: hearing.notes || ""
        })
        setError("")
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this hearing date?")) return
        try {
            await apiDelete(`/lawyer/hearings/${id}`)
            setHearings(prev => prev.filter(h => h.id !== id))
        } catch (err) {
            alert("Delete failed: " + err.message)
        }
    }

    const isUpcoming = (dateStr) => {
        const d = new Date(dateStr)
        d.setHours(23, 59, 59, 999)
        return d >= new Date()
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">📅 Case Hearing Scheduler</h2>
                <p className="text-gray-400 text-sm mt-1">Manage hearing dates, court benches, case stages, and specific notes.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Form Column */}
                <div className="w-full lg:w-[35%]">
                    <div className="card p-6 border-gold/20 bg-surface/80 backdrop-blur-md shadow-2xl sticky top-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                            <h3 className="text-gold font-bold text-sm">
                                {editingId ? "✏️ Edit Hearing Date" : "➕ Schedule Hearing"}
                            </h3>
                            {editingId && (
                                <button
                                    onClick={() => {
                                        setEditingId(null)
                                        setForm({ case_title: "", hearing_date: "", bench: "", stage: "", notes: "" })
                                        setError("")
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-white"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1.5">Case Title / Parties</label>
                                <input
                                    required
                                    value={form.case_title}
                                    onChange={e => setForm({ ...form, case_title: e.target.value })}
                                    placeholder="e.g. Ramesh vs State of UP"
                                    className="input-gold text-xs py-2.5 px-3 bg-bg/50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1.5">Hearing Date & Time</label>
                                <input
                                    required
                                    type="datetime-local"
                                    value={form.hearing_date}
                                    onChange={e => setForm({ ...form, hearing_date: e.target.value })}
                                    className="input-gold text-xs py-2.5 px-3 bg-bg/50 text-white select-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1.5">Bench / Court Room</label>
                                    <input
                                        value={form.bench}
                                        onChange={e => setForm({ ...form, bench: e.target.value })}
                                        placeholder="e.g. Court 3, Bench II"
                                        className="input-gold text-xs py-2.5 px-3 bg-bg/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1.5">Stage of Case</label>
                                    <select
                                        value={form.stage}
                                        onChange={e => setForm({ ...form, stage: e.target.value })}
                                        className="bg-surface border border-border text-white text-xs rounded-xl px-3 py-2.5 w-full outline-none focus:border-gold/50 cursor-pointer"
                                    >
                                        <option value="">Select Stage</option>
                                        <option value="Admission / Fresh">Admission / Fresh</option>
                                        <option value="Framing of Charges">Framing of Charges</option>
                                        <option value="Evidence / Witness">Evidence / Witness</option>
                                        <option value="Final Arguments">Final Arguments</option>
                                        <option value="Judgment / Order">Judgment / Order</option>
                                        <option value="Miscellaneous">Miscellaneous</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold mb-1.5">Advocate Tasks / Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Write notes, witness files to bring, or questions to ask opposing council..."
                                    rows={4}
                                    className="input-gold text-xs py-3 px-3 bg-bg/50 resize-none leading-relaxed"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2 text-red-400 text-xs">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={saving} className="btn-gold w-full py-3 text-xs shadow-goldglow hover:shadow-goldglow-lg transition-all active:scale-[0.98]">
                                {saving ? <div className="spinner-gold !border-black" /> : editingId ? "💾 Save Changes" : "🚀 Add to Schedule"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Timeline Column */}
                <div className="w-full lg:w-[65%] min-h-[500px]">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="spinner-gold" /><span className="ml-3 text-gray-400">Loading schedule…</span>
                        </div>
                    ) : hearings.length > 0 ? (
                        <div className="space-y-4">
                            {hearings.map(hearing => {
                                const upcoming = isUpcoming(hearing.hearing_date)
                                return (
                                    <div 
                                        key={hearing.id} 
                                        className={`card p-5 border-l-4 transition-all duration-300 hover:scale-[1.01] flex flex-col md:flex-row md:items-start justify-between gap-4 
                                            ${upcoming 
                                                ? "border-l-gold border-gold/10 hover:border-gold/30" 
                                                : "border-l-gray-600 bg-surface/30 opacity-60 border-border/40 hover:opacity-80"
                                            }`}
                                    >
                                        <div className="space-y-3 flex-1 min-w-0">
                                            {/* Header */}
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-white font-bold text-base truncate">{hearing.case_title}</h3>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border 
                                                        ${upcoming 
                                                            ? "bg-gold/10 text-gold border-gold/30" 
                                                            : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                                        }`}
                                                    >
                                                        {upcoming ? "Upcoming" : "Past"}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-4 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        📅 {new Date(hearing.hearing_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                                    </span>
                                                    {hearing.bench && (
                                                        <span className="flex items-center gap-1 text-gray-500">
                                                            🏛️ {hearing.bench}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stage */}
                                            {hearing.stage && (
                                                <div className="inline-block text-[10px] font-bold text-gray-300 bg-surfaceLight border border-border px-2.5 py-0.5 rounded-md">
                                                    Stage: {hearing.stage}
                                                </div>
                                            )}

                                            {/* Notes / Tasks */}
                                            {hearing.notes && (
                                                <div className="text-xs text-gray-400 bg-bg/30 p-3 rounded-lg border border-border/30 font-sans leading-relaxed whitespace-pre-wrap">
                                                    <div className="font-semibold text-[10px] uppercase text-gray-500 mb-1">Advocate Tasks & Notes:</div>
                                                    {hearing.notes}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 self-end md:self-start">
                                            <button 
                                                onClick={() => handleEdit(hearing)}
                                                className="w-8 h-8 flex items-center justify-center bg-surfaceLight hover:bg-gold/20 text-gold rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(hearing.id)}
                                                className="w-8 h-8 flex items-center justify-center bg-surfaceLight hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="card p-20 text-center border-dashed border-gray-800 text-gray-600 h-full flex flex-col justify-center bg-surface/20 min-h-[400px]">
                            <div className="text-6xl mb-4 opacity-10">📅</div>
                            <h4 className="text-lg font-bold text-gray-500">No Hearings Scheduled</h4>
                            <p className="max-w-xs mx-auto text-xs text-gray-600 mt-2 leading-relaxed">
                                Use the scheduling panel on the left to add upcoming hearing dates and track case preparation tasks.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
