// ClipList — one row per 10 s clip (text view under the trust timeline).
// Everything shown is copied from the backend's ClipResult or error — nothing is invented.
import { checkErrorText } from '../api'
import { Pill, ToneIcon } from './Tone'

const STATUS_TONE = { green: 'pass', amber: 'warn', red: 'stop', skipped: 'skip' }
const IDENTITY_TONE = { match: 'pass', no_match: 'stop', not_checked: 'skip' }

const time = (row) => `${row.t_start}–${row.t_end} s`

export default function ClipList({ rows }) {
  if (rows.length === 0) {
    return <p className="text-base text-muted">No clips yet — the first result arrives about 10 s after monitoring starts.</p>
  }
  return (
    <ul className="divide-y divide-line text-[15px]">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2">
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
      <span title={`status: ${r.status}`}><ToneIcon tone={STATUS_TONE[r.status] ?? 'skip'} className="h-4 w-4" /></span>
      <span className="w-24 font-mono">{time(row)}</span>
      {r.status === 'skipped' ? (
        <span className="text-muted">skipped (too little speech){a.error ? ` — ${checkErrorText(a.error)}` : ''}</span>
      ) : a.verdict === 'error' ? (
        <span className="text-warn-fg">check unavailable — {checkErrorText(a.error)}</span>
      ) : (
        <>
          <span className="font-semibold">{a.verdict}</span>
          <span className="text-muted">score <span className="font-mono text-white">{a.score}</span> vs threshold <span className="font-mono text-white">{a.threshold}</span> (higher = more likely AI)</span>
        </>
      )}
      <Pill tone={IDENTITY_TONE[r.identity] ?? 'skip'} className="px-2 py-0.5 text-sm">identity: {r.identity}</Pill>
      <span className="text-muted">state: {r.call_state}</span>
      <span className="ml-auto font-mono text-muted">{r.latency_ms} ms</span>
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
  return (
    <>
      <ToneIcon tone={row.state === 'error' ? 'stop' : 'skip'} className="h-4 w-4" />
      <span className="w-24 font-mono">{time(row)}</span>
      <span className={row.state === 'error' ? 'text-stop-fg' : 'text-muted'}>{text}</span>
    </>
  )
}
