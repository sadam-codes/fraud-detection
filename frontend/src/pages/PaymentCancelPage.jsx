import { Link } from 'react-router-dom'
import { Card } from '../components/PagePrimitives'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/paths'

export default function PaymentCancelPage() {
  const { user } = useAuth()
  const backHref = user ? dashboardPath(user) : '/account'
  const backLabel = user?.role === 'admin' ? 'Back to admin' : 'Back to account'
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500 ring-1 ring-slate-200">
        —
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Checkout canceled</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        No charge was made. You can try again whenever you like.
      </p>
      <Card className="mt-8 w-full border-slate-200 bg-slate-50/50 py-5 text-sm text-slate-600">
        If you closed the Stripe window by mistake, start a new checkout from your account.
      </Card>
      <Link
        to={backHref}
        className="mt-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        {backLabel}
      </Link>
    </div>
  )
}
