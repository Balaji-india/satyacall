// TrustTimeline — one bar per 10 s clip (x = clip start, height = Aletheia score, 0..1).
// Colour = the backend's clip status (voice authenticity only, v3). Skipped / unavailable clips
// get a grey band with a label and NO bar, because they have no score. The dashed line is the
// threshold from the latest response — evidence only; the backend decides with `verdict`.
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { authenticityText, speakerText } from '../checkText'
import { useCalm } from '../effects'
import { AudioWaveform } from 'lucide-react'
import { ToneIcon } from './Tone'

// Status colours (fixed meaning, always shown with a text label in the legend / tooltip).
// Agent desk (dark) status hues — the same ones as --pass/--warn/--stop/--skip in .theme-dark.
const COLOUR = { green: '#34d399', amber: '#fbbf24', red: '#f87171' }
const GREY = '#94a3b8'
const GOLD = '#d4af6a' // threshold line (evidence marker, not a verdict colour)
const AXIS = '#9fc3cf'

const LEGEND = [
  { tone: 'pass', text: 'Real voice' },
  { tone: 'warn', text: 'Mixed, or check unavailable' },
  { tone: 'stop', text: 'AI voice (fake)' },
  { tone: 'skip', text: 'Skipped / no result' },
]
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace'

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
  const calm = useCalm() // call active or "Reduce effects" → no bar animation (saves CPU)
  if (rows.length === 0) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-dashed border-line bg-inset/60 text-center">
        <div className="max-w-sm space-y-2 px-6">
          <AudioWaveform aria-hidden="true" className="mx-auto h-10 w-10 text-accent/70" />
          <p className="text-lg font-semibold text-fg">No clips yet</p>
          <p className="text-base text-muted">Once monitoring starts, the customer's voice is checked every 10 s and each clip lands here as a bar.</p>
        </div>
      </div>
    )
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
            <CartesianGrid vertical={false} stroke="rgba(230,244,248,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 14, fill: AXIS, fontFamily: MONO }} stroke="#18404f"
              label={{ value: 'clip start (seconds into the call)', position: 'insideBottom', offset: -8, fontSize: 14, fill: AXIS }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 14, fill: AXIS, fontFamily: MONO }} stroke="#18404f" width={52}
              label={{ value: 'AI score', angle: -90, position: 'insideLeft', offset: 12, fontSize: 14, fill: AXIS }} />

            {/* Grey band = this clip has no score. Spans the time slot, height means nothing. */}
            {data.filter((d) => d.missing).map((d) => (
              <ReferenceArea key={d.label} x1={d.label} x2={d.label} y1={0} y2={1}
                fill={GREY} fillOpacity={0.18} stroke="none"
                label={{ value: d.missing, position: 'insideTop', fontSize: 14, fill: '#cfe4ec' }} />
            ))}

            {latestThreshold != null && (
              <ReferenceLine y={latestThreshold} stroke={GOLD} strokeWidth={1.5} strokeDasharray="6 4"
                label={{ value: `threshold ${latestThreshold}`, position: 'insideTopRight', fontSize: 14, fill: GOLD, fontFamily: MONO }} />
            )}

            <Tooltip content={<ClipTooltip byLabel={byLabel} />} filterNull={false} cursor={{ fill: 'rgba(212,175,106,0.07)' }} />

            {/* minPointSize: a real voice scores ~0.003, so give real bars a 3 px sliver to stay
                visible. Bars with no score (null) get 0 → nothing drawn. Bars rise in with Recharts'
                own animation; the glow is a drop-shadow in the bar's own status colour. */}
            <Bar dataKey="score" isAnimationActive={!calm} animationDuration={700} animationEasing="ease-out" radius={[4, 4, 0, 0]} maxBarSize={48}
              minPointSize={(value) => (value == null ? 0 : 3)}>
              {data.map((d) => <Cell key={d.label} fill={COLOUR[d.status] ?? GREY}
                style={{ filter: `drop-shadow(0 0 4px ${COLOUR[d.status] ?? GREY}88)` }} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-base text-muted">
        {LEGEND.map((l) => (
          <li key={l.text} className="flex items-center gap-1.5"><ToneIcon tone={l.tone} className="h-4 w-4" />{l.text}</li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-gold" /> Threshold (from the response)
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
    <div className="max-w-sm space-y-1 rounded-xl border border-line bg-panel p-3 text-base text-fg shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)]">
      <p className="font-semibold">{row.t_start}–{row.t_end} s · {r ? `status ${r.status}` : d.missing}</p>
      {r ? (
        <>
          <p><b>Aletheia:</b> {r.status === 'skipped' ? 'skipped — too little speech (free, not scored)' : authenticityText(r.authenticity)}</p>
          <p><b>Eidos:</b> {speakerText(r.speaker, 'not checked — timeline uses Aletheia only')}</p>
          <p className="text-muted">call state {r.call_state} · <span className="font-mono">{r.latency_ms} ms</span></p>
        </>
      ) : (
        row.error && <p className="text-muted">{row.error}</p>
      )}
    </div>
  )
}
