import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiJson, clearToken, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const loadMe = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setReady(true)
      return
    }
    const fetchMe = () => apiJson('/auth/me')
    try {
      setUser(await fetchMe())
    } catch (err) {
      // Only clear the stored token when the API rejects the session (expired / invalid JWT).
      // Network blips or 5xx used to clear the token too and forced a login loop.
      if (err?.status === 401) {
        clearToken()
        setUser(null)
      } else {
        try {
          await new Promise((r) => setTimeout(r, 500))
          setUser(await fetchMe())
        } catch (err2) {
          if (err2?.status === 401) {
            clearToken()
            setUser(null)
          } else {
            setUser(null)
          }
        }
      }
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const login = useCallback(async (email, password) => {
    const data = await apiJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.accessToken)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (name, email, password) => {
    const data = await apiJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setToken(data.accessToken)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      register,
      logout,
      reloadUser: loadMe,
    }),
    [user, ready, login, register, logout, loadMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
