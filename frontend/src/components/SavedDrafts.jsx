import { useState, useEffect } from "react"
import { apiGet, apiDelete, apiPut, API } from "../utils/auth"
import RichTextEditor from "./RichTextEditor"

const TYPE_CONFIG = {
    consumer_complaint: { label: "Consumer Complaint", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
    rti_application: { label: "RTI Application", color: "text-green-400  border-green-400/30  bg-green-400/10" },
    police_complaint: { label: "Police Complaint", color: "text-red-400    border-red-400/30    bg-red-400/10" },
}

export default function SavedDrafts() {
    const [drafts, setDrafts] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchDrafts() }, [])

    const fetchDrafts = async () => {
        try { setDrafts(await apiGet("/citizen/drafts")) }
        catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const openDraft = async (id) => {
        try {
            const draftData = await apiGet(`/citizen/drafts/${id}`)
            setModal(draftData)
            setEditedContent(draftData.content)
            setIsEditing(false)
        }
        catch (e) { console.error(e) }
    }

    const deleteDraft = async (id) => {
        try {
            await apiDelete(`/citizen/drafts/${id}`)
            setDrafts(d => d.filter(x => x.id !== id))
            if (modal?.id === id) setModal(null)
        } catch (e) { console.error(e) }
    }

    const fmt = iso => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <div className="spinner" /><span className="ml-3 text-gray-400">Loading drafts…</span>
        </div>
    )

    if (!drafts.length) return (
        <div className="text-center py-20">
            <div className="text-5xl mb-4">📂</div>
            <p className="text-gray-400">No drafts saved yet. Generate a document first.</p>
        </div>
    )

    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-6">💾 Saved Drafts</h2>
            <div className="space-y-3">
                {drafts.map(d => {
                    const cfg = TYPE_CONFIG[d.doc_type] || { label: d.doc_type, color: "text-primary border-primary/30 bg-primary/10" }
                    return (
                        <div key={d.id} className="card px-5 py-4 flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.color}`}>
                                        {cfg.label}
                                    </span>
                                    <span className="text-white text-sm font-medium truncate">{d.title}</span>
                                </div>
                                <p className="text-gray-500 text-xs">{fmt(d.created_at)}</p>
                            </div>
                            <div className="flex gap-2 ml-4 flex-shrink-0">
                                <button onClick={() => openDraft(d.id)} className="text-primary border border-primary/30 hover:bg-primary/10 px-3 py-1.5 rounded-lg text-xs transition-all">
                                    View
                                </button>
                                <button onClick={() => deleteDraft(d.id)} className="btn-danger text-xs px-3 py-1.5">
                                    Delete
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-soft">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-border flex-shrink-0">
                            <h3 className="text-white font-bold">{modal.title}</h3>
                            <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-xl transition-colors">✕</button>
                        </div>
                        {isEditing ? (
                            <div className="flex-1 overflow-y-auto p-4 m-4">
                                <RichTextEditor value={editedContent} onChange={setEditedContent} />
                            </div>
                        ) : (
                            <div 
                                className="flex-1 overflow-y-auto p-6 font-mono text-sm text-gray-200 leading-relaxed whitespace-pre-wrap bg-bg rounded-xl m-4"
                                dangerouslySetInnerHTML={{ 
                                    __html: /<[a-z][\s\S]*>/i.test(modal.content || "") 
                                        ? modal.content 
                                        : (modal.content || "").replace(/\n/g, "<br>")
                                }}
                            />
                        )}
                        <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0 flex-wrap">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={async () => {
                                            setSaving(true)
                                            try {
                                                await apiPut(`/citizen/drafts/${modal.id}`, { content: editedContent })
                                                setModal(prev => ({ ...prev, content: editedContent }))
                                                setDrafts(prev => prev.map(d => d.id === modal.id ? { ...d, content: editedContent } : d))
                                                setIsEditing(false)
                                            } catch (err) {
                                                alert("Failed to save changes: " + err.message)
                                            } finally {
                                                setSaving(false)
                                            }
                                        }} 
                                        disabled={saving} 
                                        className="bg-green-500/20 text-green-400 border border-green-400/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-500/30 transition-all flex items-center gap-1"
                                    >
                                        {saving ? <div className="spinner !w-3 !h-3" /> : "💾 Save Changes"}
                                    </button>
                                    <button 
                                        onClick={() => { setIsEditing(false); setEditedContent(modal.content) }} 
                                        className="text-gray-400 border border-border hover:bg-surfaceLight px-4 py-2 rounded-xl text-xs transition-all"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => setIsEditing(true)} 
                                        className="bg-primary/25 text-primary hover:bg-primary/35 border border-primary/45 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        ✏️ Edit Draft
                                    </button>
                                    <button onClick={() => { 
                                        const plainText = /<[a-z][\s\S]*>/i.test(modal.content || "") 
                                            ? modal.content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<div>/gi, "").replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "")
                                            : modal.content;
                                        navigator.clipboard.writeText(plainText) 
                                        alert("Copied to clipboard!")
                                    }} className="badge-green cursor-pointer hover:opacity-80 px-4 py-2">
                                        📋 Copy
                                    </button>
                                    <button onClick={async () => {
                                        try {
                                            const token = localStorage.getItem("legal_token")
                                            const res = await fetch(`${API}/citizen/download-docx/${modal.id}`, {
                                                headers: { "Authorization": `Bearer ${token}` }
                                            })
                                            const blob = await res.blob()
                                            const url = window.URL.createObjectURL(blob)
                                            const a = document.createElement("a")
                                            a.href = url
                                            a.download = `${modal.title.replace(/\s+/g, '_')}.docx`
                                            document.body.appendChild(a)
                                            a.click()
                                            a.remove()
                                        } catch (err) {
                                            console.error("Download failed", err)
                                        }
                                    }} className="bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-full text-xs font-semibold hover:opacity-80 transition-opacity">
                                        ⬇️ Download DOCX
                                    </button>
                                    <button onClick={() => deleteDraft(modal.id)} className="btn-danger text-xs px-4 py-2 ml-auto">
                                        🗑️ Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
