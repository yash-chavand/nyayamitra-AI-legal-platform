import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { API, API_CONFIGURATION_ERROR } from "../utils/auth"

const EMPTY = { full_name: "", email: "", phone: "", matter_summary: "", opposing_party: "", important_dates: "", consent: false }

export default function ClientIntakePage() {
    const { token } = useParams()
    const [matter, setMatter] = useState(null)
    const [form, setForm] = useState(EMPTY)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        if (!API) { setError(API_CONFIGURATION_ERROR); setLoading(false); return }
        fetch(`${API}/lawyer/intake/${encodeURIComponent(token)}`)
            .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.detail || "This intake link is unavailable"); setMatter(data) })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [token])

    const submit = async event => {
        event.preventDefault()
        setSaving(true); setError("")
        try {
            const response = await fetch(`${API}/lawyer/intake/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.detail || "Could not send your information")
            setSubmitted(true)
        } catch (err) { setError(err.message) }
        finally { setSaving(false) }
    }

    return (
        <main className="min-h-screen bg-bg px-4 py-10">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-7"><span className="text-3xl">⚖️</span><span className="text-primary text-xl font-bold">NyayaMitra</span></div>
                {loading ? <div className="card p-8 text-gray-300">Loading secure intake form…</div> : error && !matter ? <div className="card p-8"><h1 className="text-xl text-white font-bold">Intake link unavailable</h1><p className="text-red-300 mt-2">{error}</p></div> : submitted ? <div className="card p-8"><h1 className="text-2xl text-white font-bold">Information sent</h1><p className="text-gray-300 mt-3">Your intake information was sent to {matter?.lawyer_name}. You can close this page.</p></div> : matter && (
                    <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
                        <p className="text-primary text-xs font-bold tracking-wide">PRIVATE CLIENT INTAKE</p>
                        <h1 className="text-2xl text-white font-bold">{matter.matter_title}</h1>
                        <p className="text-sm text-gray-400">Requested by {matter.lawyer_name}. Your answers are sent to this lawyer for this matter.</p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <label className="text-sm text-gray-300">Your full name<input required maxLength={255} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input mt-2 w-full" /></label>
                            <label className="text-sm text-gray-300">Email<input required type="email" maxLength={255} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input mt-2 w-full" /></label>
                            <label className="text-sm text-gray-300">Phone (optional)<input type="tel" maxLength={40} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input mt-2 w-full" /></label>
                            <label className="text-sm text-gray-300">Other party (optional)<input maxLength={255} value={form.opposing_party} onChange={e => setForm({ ...form, opposing_party: e.target.value })} className="input mt-2 w-full" /></label>
                        </div>
                        <label className="block text-sm text-gray-300">What happened? Include the key events and what outcome you need.<textarea required maxLength={6000} rows={5} value={form.matter_summary} onChange={e => setForm({ ...form, matter_summary: e.target.value })} className="input mt-2 w-full resize-y" /></label>
                        <label className="block text-sm text-gray-300">Important dates or upcoming deadlines (optional)<textarea maxLength={1500} rows={2} value={form.important_dates} onChange={e => setForm({ ...form, important_dates: e.target.value })} className="input mt-2 w-full resize-y" /></label>
                        <label className="flex gap-2 items-start text-sm text-gray-400"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} className="mt-1" required /><span>I consent to sending these details to the requesting lawyer for this matter. I understand this form is not an emergency channel.</span></label>
                        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                        <button disabled={saving} className="btn-primary px-5 py-3">{saving ? "Sending…" : "Send securely"}</button>
                        <p className="text-xs text-gray-500">Avoid including passwords, payment card details, or unrelated sensitive information. If anyone is in immediate danger, contact local emergency services.</p>
                    </form>
                )}
            </div>
        </main>
    )
}
