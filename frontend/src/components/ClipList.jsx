// ClipList — one row per 10 s clip (text view under the trust timeline).
// Everything shown is copied from the backend's ClipResult or error — nothing is invented.
import { checkErrorText } from '../api'

const STATUS_DOT = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-600', skipped: 'bg-slate-400' }

const IDENTITY_STYLE = {
  match: 'bg-green-100 text-green-800',
  no_match: 'bg-red-100 text-red-800',
  not_checked: 'bg-slate-100 text-slate-700',
}

const time = (row) => `${row.t_start}–${row.t_end} s`

export default function ClipList({ rows }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No clips yet — the first result arrives about 10 s after monitoring starts.</p>
  }
  return (
    <ul className="divide-y rounded border text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2">
          {row.result ? <ResultRow row={row} /> : <UploadRow row={row} />}
        </li>
      ))}
    </ul>
  )
}

// A clip the backend answered (ClipResult).
function ResultRow({ row }) {
  const r = row.result
  const a = r.authenticity ?? {}
  return (
    <>
      <span className={`inline-block h-3 w-3 rounded-full ${STATUS_DOT[r.status] ?? 'bg-slate-300'}`} title={`status: ${r.status}`} />
      <span className="w-24 font-mono">{time(row)}</span>
      {r.status === 'skipped' ? (
        <span className="text-slate-600">skipped (too little speech){a.error ? ` — ${checkErrorText(a.error)}` : ''}</span>
      ) : a.verdict === 'error' ? (
        <span className="text-amber-700">check unavailable — {checkErrorText(a.error)}</span>
      ) : (
        <>
          <span className="font-medium">{a.verdict}</span>
          <span className="text-slate-600">score {a.score} vs threshold {a.threshold} (higher = more likely AI)</span>
        </>
      )}
      <span className={`rounded px-2 py-0.5 text-sm ${IDENTITY_STYLE[r.identity] ?? 'bg-slate-100'}`}>
        identity: {r.identity}
      </span>
      <span className="text-slate-600">state: {r.call_state}</span>
      <span className="ml-auto text-slate-500">{r.latency_ms} ms</span>
    </>
  )
}

// A clip still on our side: queued, uploading, or the upload failed.
function UploadRow({ row }) {
  const text = {
    queued: 'queued…',
    uploading: 'uploading…',
    'not-sent': 'not sent — monitoring was paused',
    skipped: `skipped (too little speech) — ${row.error}`,
    error: `upload failed — ${row.error}`,
  }[row.state]
  const colour = row.state === 'error' ? 'text-red-700' : 'text-slate-500'
  return (
    <>
      <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
      <span className="w-24 font-mono">{time(row)}</span>
      <span className={colour}>{text}</span>
    </>
  )
}
