// EvidenceDrawer — bottom of /agent: every check of this call with its raw JSON, a link to
// export the backend's evidence file, and "Was this right? ✓ / ✗" → POST /api/feedback
// (forwarded to DetectifAI, free). Shows exactly what the backend returned.
import { useState } from 'react'
import { errorText, evidenceUrl, sendFeedback } from '../api'

export default function EvidenceDrawer({ m }) {
  const [open, setOpen] = useState(false)
  if (!m.callId) return null

  // All checks in arrival order: timeline clips, then Say-It-Back attempts.
  const checks = [
    ...m.rows.filter((r) => r.result).map((r) => ({
      key: r.key, title: `Clip ${r.t_start}–${r.t_end} s · status ${r.result.status}`, data: r.result,
    })),
    ...m.sayItBacks.map((s, i) => ({
      key: s.key, title: `Say-It-Back #${i + 1} · ${s.pass ? 'passed' : 'not passed'} · next step ${s.next_step}`, data: s,
    })),
  ]

  return (
    <section className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button onClick={() => setOpen(!open)} className="font-semibold">
          {open ? '▾' : '▸'} Evidence ({checks.length} checks)
        </button>
        <a href={evidenceUrl(m.callId)} target="_blank" rel="noreferrer"
          className="ml-auto rounded border px-3 py-1 text-sm hover:bg-slate-100">
          Export evidence (JSON)
        </a>
      </div>

      {open && (
        <ul className="divide-y border-t text-sm">
          {checks.length === 0 && <li className="p-3 text-slate-500">No checks yet — each 10 s clip result and each Say-It-Back attempt appears here.</li>}
          {checks.map((c) => (
            <li key={c.key} className="space-y-2 p-3">
              <p className="font-medium">{c.title}</p>
              <div className="flex flex-wrap gap-4">
                <Feedback label="Aletheia (voice authenticity)" operationId={c.data.authenticity?.operation_id} />
                {/* Eidos only when it really ran (match / no_match) */}
                {['match', 'no_match'].includes(c.data.speaker?.decision) && (
                  <Feedback label="Eidos (identity)" operationId={c.data.speaker?.operation_id} />
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-slate-600">Raw JSON</summary>
                <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-2 text-sm text-slate-300">
                  {JSON.stringify(c.data, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// "Was this right? ✓ / ✗" for one DetectifAI operation.
function Feedback({ label, operationId }) {
  const [state, setState] = useState(null) // null | { sending } | { ok, text }
  if (!operationId) return <span className="text-slate-400">{label}: no operation id (check did not run)</span>

  const send = async (correct) => {
    setState({ sending: true })
    try {
      const res = await sendFeedback({ operation_id: operationId, correct })
      setState({ ok: true, text: `sent "${correct ? 'right' : 'wrong'}" — ${JSON.stringify(res)}` })
    } catch (err) {
      setState({ ok: false, text: errorText(err) })
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-slate-600">{label} — was this right?</span>
      <button onClick={() => send(true)} disabled={state?.sending} className="rounded border px-2 disabled:opacity-40">✓</button>
      <button onClick={() => send(false)} disabled={state?.sending} className="rounded border px-2 disabled:opacity-40">✗</button>
      {state?.sending && <span className="text-slate-500">sending…</span>}
      {state?.text && <span className={`text-sm ${state.ok ? 'text-green-700' : 'text-red-700'}`}>{state.text}</span>}
    </span>
  )
}
