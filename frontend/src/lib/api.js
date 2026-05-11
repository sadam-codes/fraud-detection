const API_BASE = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

const TOKEN_KEY = 'accessToken'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function parseMessage(data) {
  if (data == null || typeof data !== 'object') return null
  const { message } = data
  if (Array.isArray(message)) return message.join(', ')
  if (typeof message === 'string') return message
  return null
}

export async function apiJson(path, options = {}) {
  const url = `${API_BASE}${path}`
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg = parseMessage(data) || (typeof data === 'string' ? data : null) || res.statusText
    const err = new Error(msg)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}
