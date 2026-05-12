import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, SectionLabel } from '../components/PagePrimitives'
import { useAuth } from '../context/AuthContext'
import { apiJson } from '../lib/api'
import { dashboardPath } from '../lib/paths'

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

const ACCOUNT_DEFAULT_PRICE_ID =
  typeof import.meta.env.VITE_ACCOUNT_DEFAULT_PRICE_ID === 'string'
    ? import.meta.env.VITE_ACCOUNT_DEFAULT_PRICE_ID.trim()
    : ''
/** Shown when no env prefill (whole number = client demo billing field). */
const DEFAULT_PRICE_FIELD_VALUE = ACCOUNT_DEFAULT_PRICE_ID || '10'

export default function AccountPage() {
  const { user, ready } = useAuth()
  const [priceId, setPriceId] = useState(DEFAULT_PRICE_FIELD_VALUE)
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
    return <Navigate to={dashboardPath(user)} replace />
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10 border-b border-slate-200/80 pb-10">
        <SectionLabel>Account</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Your profile & billing
        </h1>

      </header>

      <div className="space-y-8">
     

        <Card>
          <SectionLabel>Billing</SectionLabel>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Stripe checkout</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Card details are entered on Stripe’s hosted page. Here you only choose an optional price, then continue on
            the card below.
          </p>

          <div className="mt-8 flex justify-center sm:mt-10">
            <div className="relative w-full max-w-[26rem]">
              <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 shadow-2xl shadow-indigo-950/50 ring-1 ring-white/10 sm:rounded-3xl sm:p-8">
                <div
                  className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"
                  aria-hidden
                />

                <div className="relative z-10 flex h-full min-h-0 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                        Secure checkout
                      </p>
                      <p className="mt-1 text-xs font-medium text-white/90">Stripe · Test mode</p>
                    </div>
                    <div
                      className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 via-amber-300 to-amber-600 shadow-inner shadow-amber-900/30 ring-1 ring-amber-200/40"
                      aria-hidden
                    >
                      <span className="text-[10px] font-bold text-amber-950/80">EMV</span>
                    </div>
                  </div>

                  <div className="mt-6 min-h-0 flex-1">
                    <label
                      htmlFor="priceId"
                      className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45"
                    >
                      Price ID <span className="font-normal normal-case tracking-normal text-white/35">(optional)</span>
                    </label>
                    <input
                      id="priceId"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="e.g. 10 (demo) or price_…"
                      value={priceId}
                      onChange={(e) => setPriceId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-sm text-white shadow-inner outline-none ring-0 transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/15 focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Cardholder</p>
                      <p className="mt-0.5 truncate text-sm font-semibold tracking-wide text-white">
                        {user.name || 'Account holder'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Processor</p>
                      <p className="mt-0.5 text-xs font-bold tracking-tight text-white/90">Stripe</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startCheckout}
                    disabled={payPending}
                    className="mt-5 w-full cursor-pointer rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-black/25 transition hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {payPending ? 'Opening secure payment…' : 'Continue to payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {payError ? (
            <p
              className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              role="alert"
            >
              {payError}
            </p>
          ) : null}
        </Card>

      </div>

     
    </div>
  )
}
