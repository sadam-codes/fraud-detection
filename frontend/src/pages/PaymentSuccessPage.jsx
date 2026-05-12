import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/paths'
import { apiJson, getToken } from '../lib/api'

function findPaymentForSession(rows, sid) {
  if (!Array.isArray(rows) || !sid) return null
  return rows.find((p) => p.stripeCheckoutSessionId === sid) ?? null
}

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const { ready, user } = useAuth()
  const backHref = user ? dashboardPath(user) : '/account'
  const backLabel = user?.role === 'admin' ? 'Back to admin' : 'Back to account'
  const [syncState, setSyncState] = useState('idle')
  const [syncError, setSyncError] = useState('')
  const [paymentRow, setPaymentRow] = useState(null)

  useEffect(() => {
    if (!sessionId || !ready || !user || !getToken()) {
      return
    }
    let cancelled = false

    ;(async () => {
      setSyncState('syncing')
      setSyncError('')
      setPaymentRow(null)
      try {
        await apiJson('/payments/confirm-session', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        })
        if (cancelled) return

        const maxAttempts = 80
        const delayMs = 500
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return
          const rows = await apiJson('/payments/me')
          const found = findPaymentForSession(rows, sessionId)
          if (found) {
            setPaymentRow(found)
            setSyncState('done')
            return
          }
          if (attempt === 0) {
            setSyncState('analyzing')
          }
          await new Promise((r) => setTimeout(r, delayMs))
        }
        if (!cancelled) setSyncState('timeout')
      } catch (err) {
        if (!cancelled) {
          setSyncState('error')
          setSyncError(err.message || 'Could not record payment')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, ready, user])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700 shadow-inner ring-1 ring-emerald-200/80">
        ✓
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Payment successful</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Thanks. You can close this tab or return to your dashboard.
      </p>
      {sessionId && ready && user && syncState === 'syncing' ? (
        <p className="mt-4 text-sm text-slate-500">Confirming checkout and saving your receipt…</p>
      ) : null}
      {sessionId && ready && user && syncState === 'analyzing' ? (
        <p className="mt-4 text-sm text-slate-500">Almost done — finishing your payment record…</p>
      ) : null}
      {syncState === 'timeout' ? (
        <p className="mt-4 text-sm text-amber-800">
          Saving your payment is taking longer than expected. Open{' '}
          <Link to={backHref} className="font-semibold text-indigo-600 underline hover:text-indigo-500">
            {user?.role === 'admin' ? 'Admin' : 'Account'}
          </Link>{' '}
          and use Refresh on the payment list.
        </p>
      ) : null}
    
      {syncState === 'error' && syncError ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {syncError}
        </p>
      ) : null}
      
    </div>
  )
}
