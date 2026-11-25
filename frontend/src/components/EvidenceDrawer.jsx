// EvidenceDrawer — bottom zone of /agent: every check of this call with its raw JSON, a link to
// export the backend's evidence file, and "Was this right? ✓ / ✗" → POST /api/feedback
// (forwarded to DetectifAI, free). Shows exactly what the backend returned.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, FileJson, FolderSearch, ThumbsDown, ThumbsUp } from 'lucide-react'
import { errorText, evidenceUrl, sendFeedback } from '../api'

export default function EvidenceDrawer({ m }) {
  const [open, setOpen] = useState(false)

  // No call yet: the drawer stays as a closed bar that says what will appear here.
  if (!m.callId) {
    return (
      <section className="card flex items-center gap-3 p-4 opacity-80">
        <FolderSearch aria-hidden="true" className="h-5 w-5 text-muted" />
        <span className="font-semibold text-white">Evidence</span>
        <span className="text-base text-muted">Every clip result and Say-It-Back attempt of a monitored call appears here, with its raw JSON.</span>
      </section>
    )
  }

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
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-2 text-lg font-semibold text-white">
          <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform ${open ? '' : '-rotate-90'}`} />
          Evidence <span className="font-mono text-base font-normal text-muted">({checks.length} checks)</span>
        </button>
        <a href={evidenceUrl(m.callId)} target="_blank" rel="noreferrer" className="btn-ghost ml-auto px-3 py-2 text-[15px]">
          <FileJson aria-hidden="true" className="h-4 w-4" />Export evidence (JSON)
        </a>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }} className="divide-y divide-line border-t border-line text-[15px]">
            {checks.length === 0 && <li className="p-4 text-muted">No checks yet — each 10 s clip result and each Say-It-Back attempt appears here.</li>}
            {checks.map((c) => (
              <li key={c.key} className="space-y-2 p-4">
                <p className="font-semibold text-white">{c.title}</p>
                <div className="flex flex-wrap gap-4">
                  <Feedback label="Aletheia (voice authenticity)" operationId={c.data.authenticity?.operation_id} />
                  {/* Eidos only when it really ran (match / no_match) */}
                  {['match', 'no_match'].includes(c.data.speaker?.decision) && (
                    <Feedback label="Eidos (identity)" operationId={c.data.speaker?.operation_id} />
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-muted hover:text-white">Raw JSON</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-navy p-3 font-mono text-sm text-slate-300">
                    {JSON.stringify(c.data, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}

// "Was this right? ✓ / ✗" for one DetectifAI operation.
function Feedback({ label, operationId }) {
  const [state, setState] = useState(null) // null | { sending } | { ok, text }
  if (!operationId) return <span className="text-muted">{label}: no operation id (check did not run)</span>

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
      <span className="text-muted">{label} — was this right?</span>
      <button onClick={() => send(true)} disabled={state?.sending} className="btn-ghost px-2.5 py-1" aria-label="Right">
        <ThumbsUp aria-hidden="true" className="h-4 w-4" />✓
      </button>
      <button onClick={() => send(false)} disabled={state?.sending} className="btn-ghost px-2.5 py-1" aria-label="Wrong">
        <ThumbsDown aria-hidden="true" className="h-4 w-4" />✗
      </button>
      {state?.sending && <span className="text-muted">sending…</span>}
      {state?.text && <span className={state.ok ? 'text-pass-fg' : 'text-stop-fg'}>{state.text}</span>}
    </span>
  )
}
