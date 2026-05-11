/** Shared layout primitives for the light professional theme. */

export function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8 ${className}`}
    >
      {children}
    </section>
  )
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
      {children}
    </p>
  )
}
