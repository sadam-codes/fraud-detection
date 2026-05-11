import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/paths'

export default function HomePage() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-16 lg:gap-20">
      <section className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Fraud-aware payments
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Checkout intelligence you can{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              trust in the room
            </span>
            .
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Run secure test payments, capture Stripe sessions, and surface AI-assisted fraud signals with a
            clear, client-ready experience.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {user ? (
              <Link
                to={dashboardPath(user)}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-100/80 via-white to-violet-100/60 blur-2xl lg:-inset-8" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/60">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Post-checkout review</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Sessions sync to your workspace with fraud status and rationale, ready for your account and
                  admin views.
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe</p>
                <p className="mt-1 text-sm font-medium text-slate-800">Test Checkout</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signals</p>
                <p className="mt-1 text-sm font-medium text-slate-800">AI-assisted flags</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
