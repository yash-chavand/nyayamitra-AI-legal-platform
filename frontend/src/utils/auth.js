// ── Token & Session ─────────────────────────
const TOKEN_KEY = "legal_token"
const USERNAME_KEY = "legal_username"
const ROLE_KEY = "legal_role"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getUsername = () => localStorage.getItem(USERNAME_KEY)
export const getRole = () => localStorage.getItem(ROLE_KEY)

export const setSession = (token, username, role) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USERNAME_KEY, username)
    localStorage.setItem(ROLE_KEY, role)
}

export const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem(ROLE_KEY)
}

export const isAuthenticated = () => {
    const token = getToken()
    if (!token) return false
    try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        return payload.exp * 1000 > Date.now()
    } catch {
        return false
    }
}

export const isLawyer = () => getRole() === "lawyer"

// ── Fetch helpers ────────────────────────────
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
const isVercelPreview = import.meta.env.VERCEL_ENV === "preview"
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || (isLocal
    ? "http://127.0.0.1:8000"
    : isVercelPreview ? "" : "https://nyayamitra-backend-2dug.onrender.com")

export const API = BASE_URL ? `${BASE_URL}/api` : ""
export const API_CONFIGURATION_ERROR = "Preview API is not configured. Set VITE_API_BASE_URL to the separate staging backend URL."

const requireApi = () => {
    if (!API) throw new Error(API_CONFIGURATION_ERROR)
}

export const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`
})

export const apiGet = async (path) => {
    requireApi()
    const res = await fetch(`${API}${path}`, { headers: authHeaders() })
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed")
    return res.json()
}

export const apiPost = async (path, body) => {
    requireApi()
    const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed")
    return res.json()
}

export const apiDelete = async (path) => {
    requireApi()
    const res = await fetch(`${API}${path}`, { method: "DELETE", headers: authHeaders() })
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed")
    return res.json()
}

export const apiPut = async (path, body) => {
    requireApi()
    const res = await fetch(`${API}${path}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed")
    return res.json()
}
