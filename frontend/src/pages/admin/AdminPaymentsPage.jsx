import { useCallback, useEffect, useState } from 'react'
import { Card, SectionLabel } from '../../components/PagePrimitives'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'

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

function formatPaymentWhen(payment) {
  const iso = payment.checkoutPaidAt ?? payment.createdAt
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    })
  } catch {
    return '—'
  }
}

function PaymentHistorySkeleton() {
  return (
    <div
      className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      aria-hidden="true"
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-full max-w-[12rem] animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-7 w-16 shrink-0 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

export default function AdminPaymentsPage() {
  const { ready, user } = useAuth()
  const [payments, setPayments] = useState([])
  const [paymentsError, setPaymentsError] = useState('')
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsHydrated, setPaymentsHydrated] = useState(false)
  const [fraudReviewSavingId, setFraudReviewSavingId] = useState(null)

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

  const updateFraudReview = useCallback(
    async (paymentId, status) => {
      setFraudReviewSavingId(paymentId)
      setPaymentsError('')
      try {
        await apiJson(`/payments/admin/${paymentId}/fraud-review`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        await loadPayments()
      } catch (err) {
        setPaymentsError(err.message || 'Could not update fraud review')
      } finally {
        setFraudReviewSavingId(null)
      }
    },
    [loadPayments],
  )

  useEffect(() => {
    if (ready && user?.role === 'admin') loadPayments()
  }, [ready, user, loadPayments])

  const initialPaymentsLoading = paymentsLoading && !paymentsHydrated
  const refreshingPayments = paymentsLoading && paymentsHydrated

  return (
    <Card className="relative min-h-[18rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <SectionLabel>Payments</SectionLabel>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">All payments</h1>
        </div>
        <button
          type="button"
          onClick={() => loadPayments()}
          disabled={paymentsLoading}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
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
          <ul className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/80 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
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
                      <span
                        className="tabular-nums"
                        title={
                          p.checkoutPaidAt
                            ? 'Stripe payment time (shown in your local timezone)'
                            : 'Saved when processed; Stripe payment time unavailable for this row'
                        }
                      >
                        {p.checkoutPaidAt || p.createdAt ? (
                          <>
                            {p.checkoutPaidAt ? 'Paid ' : 'Recorded '}
                            {formatPaymentWhen(p)}
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 ring-1 ring-slate-200/80">
                      {p.paymentStatus ?? '—'}
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {p.checkoutMode ?? '—'}
                    </span>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Fraud review
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm outline-none ring-slate-200 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                    value={p.fraudFlagged ? 'flagged' : 'cleared'}
                    disabled={fraudReviewSavingId === p.id}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === 'flagged' && p.fraudFlagged) return
                      if (next === 'cleared' && !p.fraudFlagged) return
                      updateFraudReview(p.id, next)
                    }}
                  >
                    <option value="cleared">Succeeded (cleared)</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </label>
                {p.fraudFlagged && p.fraudReason ? (
                  <p className="text-sm leading-relaxed text-amber-900">{p.fraudReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  )
}
