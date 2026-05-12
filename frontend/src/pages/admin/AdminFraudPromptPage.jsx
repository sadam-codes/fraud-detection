import { useCallback, useEffect, useState } from 'react'
import { Card, SectionLabel } from '../../components/PagePrimitives'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'

export default function AdminFraudPromptPage() {
  const { ready, user } = useAuth()
  const [fraudPromptText, setFraudPromptText] = useState('')
  const [fraudPromptSource, setFraudPromptSource] = useState('built_in')
  const [fraudPromptUpdatedAt, setFraudPromptUpdatedAt] = useState(null)
  const [fraudPromptLoadState, setFraudPromptLoadState] = useState('idle')
  const [fraudPromptSaving, setFraudPromptSaving] = useState(false)
  const [fraudPromptError, setFraudPromptError] = useState('')

  const loadFraudPrompt = useCallback(async () => {
    setFraudPromptError('')
    setFraudPromptLoadState('loading')
    try {
      const d = await apiJson('/payments/admin/fraud-prompt')
      setFraudPromptText(typeof d.systemPrompt === 'string' ? d.systemPrompt : '')
      setFraudPromptSource(d.source === 'database' ? 'database' : 'built_in')
      setFraudPromptUpdatedAt(d.updatedAt ?? null)
      setFraudPromptLoadState('done')
    } catch (err) {
      setFraudPromptLoadState('error')
      setFraudPromptError(err.message || 'Could not load fraud prompt')
    }
  }, [])

  useEffect(() => {
    if (ready && user?.role === 'admin') loadFraudPrompt()
  }, [ready, user, loadFraudPrompt])

  async function saveFraudPrompt() {
    setFraudPromptSaving(true)
    setFraudPromptError('')
    try {
      const r = await apiJson('/payments/admin/fraud-prompt', {
        method: 'PUT',
        body: JSON.stringify({ systemPrompt: fraudPromptText }),
      })
      setFraudPromptUpdatedAt(r.updatedAt ?? null)
      setFraudPromptSource('database')
    } catch (err) {
      setFraudPromptError(err.message || 'Could not save prompt')
    } finally {
      setFraudPromptSaving(false)
    }
  }

  async function resetFraudPromptToBuiltIn() {
    setFraudPromptSaving(true)
    setFraudPromptError('')
    try {
      await apiJson('/payments/admin/fraud-prompt', { method: 'DELETE' })
      await loadFraudPrompt()
    } catch (err) {
      setFraudPromptError(err.message || 'Could not reset prompt')
    } finally {
      setFraudPromptSaving(false)
    }
  }

  return (
    <Card>
      <SectionLabel>Fraud model</SectionLabel>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Groq system prompt</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
        This text is sent as the <span className="font-medium text-slate-800">system</span> message for each new
        checkout fraud review. Edit it here and save; the next payments processed by the worker will use the updated
        prompt. Include instructions that the model must return only{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
          {`{"fraudulent":boolean,"reason":string|null}`}
        </code>
        .
      </p>
      {fraudPromptLoadState === 'loading' ? (
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
      ) : null}
      {fraudPromptLoadState === 'error' && fraudPromptError ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {fraudPromptError}
        </p>
      ) : null}
      {fraudPromptLoadState === 'done' ? (
        <>
          <textarea
            value={fraudPromptText}
            onChange={(e) => setFraudPromptText(e.target.value)}
            spellCheck={false}
            className="mt-6 min-h-[18rem] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 font-mono text-xs leading-relaxed text-slate-900 outline-none ring-slate-200 transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            aria-label="Groq fraud system prompt"
          />
          <p className="mt-2 text-xs text-slate-500">
            {fraudPromptSource === 'database' ? 'Using saved copy from the database.' : 'Showing built-in default (no saved row yet).'}
            {fraudPromptUpdatedAt
              ? ` Last saved: ${new Date(fraudPromptUpdatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })}.`
              : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveFraudPrompt()}
              disabled={fraudPromptSaving}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {fraudPromptSaving ? 'Saving…' : 'Save prompt'}
            </button>
           
          </div>
          {fraudPromptError && fraudPromptLoadState === 'done' ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {fraudPromptError}
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}
