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

export default function AdminPage() {
  const { user, ready } = useAuth()
  const [payments, setPayments] = useState([])
  const [paymentsError, setPaymentsError] = useState('')
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsHydrated, setPaymentsHydrated] = useState(false)

  const loadPayments = useCallback(async () => {
    setPaymentsError('')
    setPaymentsLoading(true)
    try {
      const rows = await apiJson('/payments/admin')
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
    if (ready && user?.role === 'admin') loadPayments()
  }, [ready, user, loadPayments])

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/80" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'admin') {
    return <Navigate to="/account" replace />
  }

  const initialPaymentsLoading = paymentsLoading && !paymentsHydrated
  const refreshingPayments = paymentsLoading && paymentsHydrated

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10 border-b border-slate-200/80 pb-10">
        <SectionLabel>Admin</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">All payments</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Read-only list of recorded checkouts across users. No Stripe checkout is started from this view.
        </p>
      </header>

      <Card className="relative min-h-[18rem]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionLabel>History</SectionLabel>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Payments</h2>
          </div>
          <button
            type="button"
            onClick={() => loadPayments()}
            disabled={paymentsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
          >
            {refreshingPayments ? (
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
                aria-hidden="true"
              />
            ) : null}
            {refreshingPayments ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {paymentsError ? (
          <p
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {paymentsError}
          </p>
        ) : null}

        <div
          className={`mt-6 ${refreshingPayments && payments.length > 0 ? 'opacity-60 transition-opacity' : ''}`}
          aria-busy={refreshingPayments}
        >
          {initialPaymentsLoading && !paymentsError ? <PaymentHistorySkeleton /> : null}

          {!paymentsLoading && payments.length === 0 && !paymentsError ? (
            <p className="mt-6 text-sm text-slate-600">No payments recorded yet.</p>
          ) : null}

          {payments.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="grid gap-4 py-5 first:pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-8"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-bold tabular-nums text-slate-900">
                      {formatMoney(p.amountTotal, p.currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.user?.email ? (
                        <span className="font-medium text-slate-700">{p.user.email}</span>
                      ) : (
                        <span className="text-slate-400">No linked user</span>
                      )}
                      {' · '}
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 ring-1 ring-slate-200/80">
                      {p.paymentStatus ?? '—'}
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {p.checkoutMode ?? '—'}
                    </span>
                    {p.fraudFlagged ? (
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                        Fraud flagged
                      </span>
                    ) : (
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                        Fraud cleared
                      </span>
                    )}
                  </div>
                  {p.fraudFlagged && p.fraudReason ? (
                    <p className="text-sm leading-relaxed text-amber-900 sm:col-span-2">{p.fraudReason}</p>
                  ) : null}
                  {p.stripeCheckoutSessionId ? (
                    <p className="break-all font-mono text-[11px] leading-relaxed text-slate-500 sm:col-span-2">
                      {p.stripeCheckoutSessionId}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>

      <footer className="mt-14 border-t border-slate-200/80 pt-10">
        <Link to="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
          ← Home
        </Link>
      </footer>
    </div>
  )
}
