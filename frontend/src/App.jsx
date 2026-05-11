import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AccountPage from './pages/AccountPage'
import AdminPage from './pages/AdminPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import RegisterPage from './pages/RegisterPage'

function AppShell({ children }) {
  const { user, ready, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 font-sans text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 shadow-sm shadow-slate-200/40 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/25">
              S
            </span>
            <span className="hidden sm:inline">SecurePay</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 text-sm font-medium">
            {!ready ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-500">Loading…</span>
            ) : user ? (
              <>
                {user.role !== 'admin' ? (
                  <Link
                    to="/account"
                    className={`rounded-full px-3 py-1.5 transition ${
                      location.pathname === '/account'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Account
                  </Link>
                ) : null}
                {user.role === 'admin' ? (
                  <Link
                    to="/admin"
                    className={`rounded-full px-3 py-1.5 transition ${
                      location.pathname === '/admin'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Admin
                  </Link>
                ) : null}
                <span
                  className="hidden max-w-[12rem] truncate text-slate-500 md:inline"
                  title={user.email}
                >
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/', { replace: true })
                  }}
                  className="rounded-full px-3 py-1.5 text-rose-600 transition hover:bg-rose-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`rounded-full px-3 py-1.5 transition ${
                    location.pathname === '/login'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-indigo-600 px-4 py-2 text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-500"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="mx-auto w-full max-w-6xl flex-1">{children}</div>
      </main>
      <footer className="border-t border-slate-200/80 bg-white/60 py-8 text-center text-xs text-slate-500 backdrop-blur-sm">
        <p className="mx-auto max-w-6xl px-4">
          Development · API{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
            {import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}
          </code>
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/cancel" element={<PaymentCancelPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
