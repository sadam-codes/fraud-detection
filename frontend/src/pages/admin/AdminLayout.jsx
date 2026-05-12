import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { SectionLabel } from '../../components/PagePrimitives'
import { useAuth } from '../../context/AuthContext'

const navClass =
  'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition'
const navInactive = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
const navActive = 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/80'

export default function AdminLayout() {
  const { user, ready } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.title = 'Admin — SecurePay'
  }, [location.pathname])

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true" aria-label="Loading">
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-56">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
          <SectionLabel>Admin</SectionLabel>
          <p className="mt-1 text-xs font-medium text-slate-500">Navigation</p>
          <nav className="mt-4 flex flex-col gap-1" aria-label="Admin sections">
            <NavLink
              to="/admin/fraud-prompt"
              className={({ isActive }) => `${navClass} ${isActive ? navActive : navInactive}`}
            >
              Groq system prompt
            </NavLink>
            <NavLink
              to="/admin/payments"
              end
              className={({ isActive }) => `${navClass} ${isActive ? navActive : navInactive}`}
            >
              All payments
            </NavLink>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
        <footer className="mt-12 border-t border-slate-200/80 pt-8">
          <Link to="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
            ← Home
          </Link>
        </footer>
      </div>
    </div>
  )
}
