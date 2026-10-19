import { useEffect, useState } from "react"
import { apiDelete, apiGet, apiPost, apiPut } from "../utils/auth"

const EMPTY = { client_name: "", contact_email: "", matter_title: "", status: "Intake", next_action: "", next_action_date: "", notes: "" }

export default function ClientMatters() {
    const [matters, setMatters] = useState([])
    const [form, setForm] = useState(EMPTY)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(null)
    const [editingId, setEditingId] = useState(null)

    const refresh = async () => {
        setLoading(true)
        try { setMatters(await apiGet("/lawyer/matters")); setError("") }
        catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }
    useEffect(() => { refresh() }, [])

    const createMatter = async (event) => {
        event.preventDefault()
        setSaving(true); setError("")
        try {
            if (editingId) await apiPut(`/lawyer/matters/${editingId}`, form)
            else await apiPost("/lawyer/matters", form)
            setForm(EMPTY)
            setEditingId(null)
            await refresh()
        } catch (err) { setError(err.message) }
        finally { setSaving(false) }
    }

    const saveStatus = async (matter, status) => {
        try {
            const updated = await apiPut(`/lawyer/matters/${matter.id}`, { ...matter, status })
            setMatters(items => items.map(item => item.id === matter.id ? { ...item, ...updated } : item))
        } catch (err) { setError(err.message) }
    }

    const copyLink = async (token, id) => {
        const link = `${window.location.origin}/intake/${token}`
        try {
            await navigator.clipboard.writeText(link)
            setCopied(id); window.setTimeout(() => setCopied(null), 2000)
        } catch { window.prompt("Copy this client intake link", link) }
    }

    const removeMatter = async (matter) => {
        if (!window.confirm(`Delete the matter for ${matter.client_name}? Its intake response will also be deleted.`)) return
        try { await apiDelete(`/lawyer/matters/${matter.id}`); setMatters(items => items.filter(item => item.id !== matter.id)) }
        catch (err) { setError(err.message) }
    }

    const editMatter = matter => {
        setEditingId(matter.id)
        setForm({ client_name: matter.client_name || "", contact_email: matter.contact_email || "", matter_title: matter.matter_title || "", status: matter.status || "Intake", next_action: matter.next_action || "", next_action_date: matter.next_action_date || "", notes: matter.notes || "" })
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    return (
        <div className="max-w-6xl mx-auto space-y-7 pb-14">
            <div>
                <p className="text-gold text-sm font-semibold">LAWYER WORKSPACE</p>
                <h2 className="text-2xl font-bold text-white mt-1">Clients & matters</h2>
                <p className="text-gray-400 text-sm mt-2">Track next actions and collect case details through a private intake link that expires after 30 days.</p>
            </div>
            <form onSubmit={createMatter} className="card p-5 space-y-4">
                <h3 className="text-white font-semibold">{editingId ? "Update matter" : "Create a matter and intake link"}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <label className="text-sm text-gray-300">Client name<input required value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} className="input mt-2 w-full" /></label>
                    <label className="text-sm text-gray-300">Client email (optional)<input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="input mt-2 w-full" /></label>
                    <label className="text-sm text-gray-300">Matter title<input required value={form.matter_title} onChange={e => setForm({ ...form, matter_title: e.target.value })} placeholder="e.g. Consumer refund claim" className="input mt-2 w-full" /></label>
                    <label className="text-sm text-gray-300">Next action<input value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })} placeholder="e.g. Review contract" className="input mt-2 w-full" /></label>
                    <label className="text-sm text-gray-300">Action due date<input type="date" value={form.next_action_date} onChange={e => setForm({ ...form, next_action_date: e.target.value })} className="input mt-2 w-full" /></label>
                    <label className="text-sm text-gray-300">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input mt-2 w-full">{["Intake", "Review", "In progress", "Waiting", "Closed"].map(s => <option key={s}>{s}</option>)}</select></label>
                </div>
                <label className="block text-sm text-gray-300">Internal notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input mt-2 w-full" /></label>
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <div className="flex gap-2"><button disabled={saving} className="btn-gold px-5 py-2.5">{saving ? "Saving…" : editingId ? "Save matter" : "Create matter"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY) }} className="text-sm text-gray-400 border border-border rounded-lg px-4">Cancel</button>}</div>
            </form>

            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Your matters</h3>
                {loading ? <p className="text-sm text-gray-400">Loading matters…</p> : matters.length === 0 ? <p className="card p-6 text-sm text-gray-400">No matters yet. Create one above to get a client intake link.</p> : matters.map(matter => (
                    <article key={matter.id} className="card p-5 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div><div className="flex items-center gap-2 flex-wrap"><h4 className="text-white font-semibold">{matter.matter_title}</h4><span className="text-xs rounded-full px-2.5 py-1 bg-gold/10 text-gold border border-gold/20">{matter.status}</span></div><p className="text-sm text-gray-400 mt-1">{matter.client_name}{matter.contact_email ? ` · ${matter.contact_email}` : ""}</p></div>
                            <div className="flex gap-2 shrink-0"><button onClick={() => editMatter(matter)} className="text-xs text-gray-300 border border-border rounded-lg px-3 py-2">Edit</button><button onClick={() => copyLink(matter.intake_token, matter.id)} className="btn-gold text-xs px-3 py-2">{copied === matter.id ? "Copied" : "Copy intake link"}</button><button onClick={() => removeMatter(matter)} className="text-xs text-red-400 border border-red-400/20 rounded-lg px-3 py-2 hover:bg-red-500/10">Delete</button></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <label className="text-gray-400">Update status<select value={matter.status} onChange={e => saveStatus(matter, e.target.value)} className="input mt-1.5 w-full">{["Intake", "Review", "In progress", "Waiting", "Closed"].map(s => <option key={s}>{s}</option>)}</select></label>
                            <div className="text-gray-400">Next action{matter.next_action ? <p className="text-gray-200 mt-1">{matter.next_action}{matter.next_action_date ? ` · due ${matter.next_action_date}` : ""}</p> : <p className="text-gray-500 mt-1">No action date set</p>}</div>
                        </div>
                        {matter.intake_submitted_at && matter.intake_data && <details className="border-t border-border pt-3"><summary className="text-sm text-primary cursor-pointer">Client intake received · {new Date(matter.intake_submitted_at).toLocaleDateString()}</summary><div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm text-gray-300">{[["Name", matter.intake_data.full_name], ["Email", matter.intake_data.email], ["Phone", matter.intake_data.phone], ["Other party", matter.intake_data.opposing_party], ["Important dates", matter.intake_data.important_dates], ["Summary", matter.intake_data.matter_summary]].filter(([, value]) => value).map(([label, value]) => <p key={label}><span className="text-gray-500">{label}: </span>{value}</p>)}</div></details>}
                        <p className="text-xs text-gray-500">Private to your account. Client intake responses can contain sensitive information; share links only with the intended client.</p>
                    </article>
                ))}
            </section>
        </div>
    )
}
