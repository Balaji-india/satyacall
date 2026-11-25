// TrustTimeline — one bar per 10 s clip (x = clip start, height = Aletheia score, 0..1).
// Colour = the backend's clip status (voice authenticity only, v3). Skipped / unavailable clips
// get a grey band with a label and NO bar, because they have no score. The dashed line is the
// threshold from the latest response — evidence only; the backend decides with `verdict`.
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { authenticityText, speakerText } from '../checkText'

// Status colours (fixed meaning, always shown with a text label in the legend / tooltip).
const COLOUR = { green: '#0ca30c', amber: '#fab219', red: '#d03b3b' }
const GREY = '#94a3b8'

const LEGEND = [
  { colour: COLOUR.green, text: 'real voice' },
  { colour: COLOUR.amber, text: 'mixed, or check unavailable' },
  { colour: COLOUR.red, text: 'AI voice (fake)' },
  { colour: GREY, text: 'skipped / no result' },
]

// Text for a clip that has no score (grey band) — or null if it has one.
function noScoreText(row) {
  const r = row.result
  if (!r) {
    return { queued: 'queued', uploading: 'checking…', 'not-sent': 'not sent', skipped: 'skipped', error: 'upload failed' }[row.state]
  }
  if (r.status === 'skipped') return 'skipped'
  if (r.authenticity?.verdict === 'error' || r.authenticity?.score == null) return 'check unavailable'
  return null
}

export default function TrustTimeline({ rows }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No clips yet — the first bar appears about 10 s after monitoring starts.</p>
  }

  // One chart row per clip, in call order. score stays null when the backend gave none.
  const data = rows.map((row) => {
    const missing = noScoreText(row)
    return {
      label: `${row.t_start}s`,
      score: missing ? null : row.result.authenticity.score,
      status: row.result?.status,
      missing,
      row,
    }
  })
  const byLabel = Object.fromEntries(data.map((d) => [d.label, d]))

  // Threshold from the most recent result that has one (DetectifAI sends it, we don't pick it).
  const latestThreshold = [...rows].reverse().find((r) => r.result?.authenticity?.threshold != null)
    ?.result.authenticity.threshold

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: '#c0cad8' }} stroke="rgba(255,255,255,0.25)"
              label={{ value: 'clip start (seconds into the call)', position: 'insideBottom', offset: -8, fontSize: 13, fill: '#a3b1c6' }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 13, fill: '#c0cad8' }} stroke="rgba(255,255,255,0.25)" width={48}
              label={{ value: 'AI score', angle: -90, position: 'insideLeft', offset: 12, fontSize: 13, fill: '#a3b1c6' }} />

            {/* Grey band = this clip has no score. Spans the time slot, height means nothing. */}
            {data.filter((d) => d.missing).map((d) => (
              <ReferenceArea key={d.label} x1={d.label} x2={d.label} y1={0} y2={1}
                fill={GREY} fillOpacity={0.18} stroke="none"
                label={{ value: d.missing, position: 'insideTop', fontSize: 12, fill: '#c0cad8' }} />
            ))}

            {latestThreshold != null && (
              <ReferenceLine y={latestThreshold} stroke="#e2e8f0" strokeDasharray="5 4"
                label={{ value: `threshold ${latestThreshold}`, position: 'insideTopRight', fontSize: 13, fill: '#e2e8f0' }} />
            )}

            <Tooltip content={<ClipTooltip byLabel={byLabel} />} filterNull={false} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />

            {/* minPointSize: a real voice scores ~0.003, so give real bars a 3 px sliver to stay
                visible. Bars with no score (null) get 0 → nothing drawn. Bars rise in with Recharts'
                own animation; the glow is a drop-shadow in the bar's own status colour. */}
            <Bar dataKey="score" isAnimationActive animationDuration={700} animationEasing="ease-out" radius={[4, 4, 0, 0]} maxBarSize={48}
              minPointSize={(value) => (value == null ? 0 : 3)}>
              {data.map((d) => <Cell key={d.label} fill={COLOUR[d.status] ?? GREY}
                style={{ filter: `drop-shadow(0 0 6px ${COLOUR[d.status] ?? GREY})` }} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        {LEGEND.map((l) => (
          <li key={l.text} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.colour, boxShadow: `0 0 8px ${l.colour}` }} /> {l.text}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="inline-block w-5 border-t-2 border-dashed border-slate-700" /> threshold (from the response)
        </li>
      </ul>
    </div>
  )
}

// Hover card: the raw values for one clip (Aletheia + Eidos), straight from the ClipResult.
function ClipTooltip({ active, label, byLabel }) {
  const d = byLabel[label]
  if (!active || !d) return null
  const { row } = d
  const r = row.result
  return (
    <div className="max-w-xs space-y-0.5 rounded-xl border border-white/15 bg-night/95 p-3 text-sm text-ink shadow-xl backdrop-blur">
      <p className="font-semibold">{row.t_start}–{row.t_end} s · {r ? `status ${r.status}` : d.missing}</p>
      {r ? (
        <>
          <p><b>Aletheia:</b> {r.status === 'skipped' ? 'skipped — too little speech (free, not scored)' : authenticityText(r.authenticity)}</p>
          <p><b>Eidos:</b> {speakerText(r.speaker, 'not checked — timeline uses Aletheia only')}</p>
          <p className="text-slate-500">call state {r.call_state} · {r.latency_ms} ms</p>
        </>
      ) : (
        row.error && <p className="text-slate-600">{row.error}</p>
      )}
    </div>
  )
}
