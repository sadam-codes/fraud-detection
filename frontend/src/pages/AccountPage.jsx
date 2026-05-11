import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Card, SectionLabel } from '../components/PagePrimitives'
import { useAuth } from '../context/AuthContext'
import { apiJson } from '../lib/api'

function formatMoney(amount, currency) {
  if (amount == null || !currency) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`
  }
}

function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" aria-busy="true" aria-label="Loading account">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200/80" />
      <div className="h-52 animate-pulse rounded-2xl bg-slate-200/80" />
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200/80" />
    </div>
  )
}

const STRIPE_PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/
const DEMO_INT_RE = /^-?\d+$/

function isValidOptionalBillingField(trimmed) {
  if (!trimmed) return true
  return STRIPE_PRICE_ID_RE.test(trimmed) || DEMO_INT_RE.test(trimmed)
}

function PaymentHistorySkeleton() {
  return (
    <div className="mt-6 space-y-0 divide-y divide-slate-100" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-4 first:pt-0">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-8 w-20 shrink-0 animate-pulse rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

export default function AccountPage() {
  const { user, ready, logout } = useAuth()
  const [priceId, setPriceId] = useState('')
  const [payError, setPayError] = useState('')
  const [payPending, setPayPending] = useState(false)
  const [payments, setPayments] = useState([])
  const [paymentsError, setPaymentsError] = useState('')
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsHydrated, setPaymentsHydrated] = useState(false)

  const loadPayments = useCallback(async () => {
    setPaymentsError('')
    setPaymentsLoading(true)
    try {
      const rows = await apiJson('/payments/me')
      setPayments(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setPaymentsError(err.message || 'Could not load payments')
      setPayments([])
    } finally {
      setPaymentsLoading(false)
      setPaymentsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (ready && user) loadPayments()
  }, [ready, user, loadPayments])

  async function startCheckout() {
    setPayError('')
    const trimmed = priceId.trim()
    if (trimmed && !isValidOptionalBillingField(trimmed)) {
      setPayError(
        'Enter a Stripe Price ID (price_…) or a whole number (e.g. -100 for a client demo). Leave empty for the server default.',
      )
      return
    }
    setPayPending(true)
    try {
      const body = {}
      if (trimmed) body.priceId = trimmed
      const { url } = await apiJson('/payments/checkout-session', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (url) {
        window.location.href = url
        return
      }
      setPayError('No checkout URL returned')
    } catch (err) {
      setPayError(err.message || 'Checkout failed')
    } finally {
      setPayPending(false)
    }
  }

  if (!ready) {
    return <AccountLoading />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  const initialPaymentsLoading = paymentsLoading && !paymentsHydrated
  const refreshingPayments = paymentsLoading && paymentsHydrated

  const initials =
    user.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10 border-b border-slate-200/80 pb-10">
        <SectionLabel>Account</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Your profile & billing
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Manage test checkouts and view payment history tied to this account.
        </p>
      </header>

      <div className="space-y-8">
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/25"
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <SectionLabel>Signed in as</SectionLabel>
                <p className="mt-1 truncate text-xl font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-sm text-slate-600">{user.email}</p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200/80">
              {user.role}
            </span>
          </div>
        </Card>

        <Card>
            <SectionLabel>Billing</SectionLabel>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Stripe test checkout</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Opens Checkout in test mode. Default price comes from{' '}
              <code className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[13px] text-indigo-700 ring-1 ring-slate-200">
                STRIPE_PRICE_ID
              </code>{' '}
              on the server, or use the field below for a Price ID or a demo number (including negative).
            </p>
            <div className="mt-6">
              <label htmlFor="priceId" className="text-sm font-semibold text-slate-800">
                Price ID <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="priceId"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="price_… or e.g. -50"
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                For demos: a whole number is stored on the session for fraud review; the charge still uses your
                server Stripe price when no valid <span className="font-mono text-slate-600">price_</span> ID is
                given.
              </p>
            </div>
            {payError ? (
              <p
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                role="alert"
              >
                {payError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={startCheckout}
              disabled={payPending}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {payPending ? 'Redirecting to Stripe…' : 'Pay with Stripe (test)'}
            </button>
        </Card>

      </div>

      <footer className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-slate-200/80 pt-10">
        <Link to="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
          ← Home
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
        >
          Log out
        </button>
      </footer>
    </div>
  )
}
