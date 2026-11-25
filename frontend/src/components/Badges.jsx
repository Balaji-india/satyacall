// Badges — call state (VERIFYING / VERIFIED / WATCH / ALERT) and the separate identity badge.
// Colour always comes with a text label, never colour alone. Both are pills with a status dot;
// the call-state pill is bigger and spells out "(voice authenticity)" so the two are never confused.

// Pill colours per state: tinted glass + coloured border/dot, with a glow in the state colour.
const STATE_STYLE = {
  verifying: { pill: 'border-white/20 bg-white/5 text-ink', dot: 'bg-slate-400' },
  verified: { pill: 'border-pass/60 bg-pass/15 text-green-700 glow-pass', dot: 'bg-pass' },
  watch: { pill: 'border-warn/60 bg-warn/15 text-amber-700 glow-warn', dot: 'bg-warn' },
  alert: { pill: 'border-stop/70 bg-stop/20 text-red-700 glow-stop', dot: 'bg-stop live-dot' },
}
const NONE = { pill: 'border-white/15 bg-white/5 text-slate-500', dot: 'bg-slate-400' }

const IDENTITY_STYLE = {
  match: { pill: 'border-pass/60 bg-pass/15 text-green-700 glow-pass', dot: 'bg-pass' },
  no_match: { pill: 'border-stop/70 bg-stop/20 text-red-700 glow-stop', dot: 'bg-stop' },
  not_checked: { pill: 'border-white/15 bg-white/5 text-slate-600', dot: 'bg-slate-400' },
}

const IDENTITY_TEXT = { match: 'match', no_match: 'no match', not_checked: 'not checked' }

const PILL = 'badge-in inline-flex items-center gap-2 rounded-full border px-4 py-1.5'
const DOT = 'inline-block h-2.5 w-2.5 shrink-0 rounded-full'

// state = the backend's call_state (null before the first result).
// Reads "Call state: VERIFIED (voice authenticity)" so it is never taken for the identity badge.
// key={state}: React re-mounts the pill when the state changes, so it animates in again only then.
export function StateBadge({ state }) {
  const s = STATE_STYLE[state] ?? NONE
  return (
    <span key={state ?? 'none'} className={`${PILL} ${s.pill}`}
      title="Call state = voice authenticity over the call (Aletheia: real human voice or AI-generated?)">
      <span className={`${DOT} ${s.dot}`} />
      <span className="text-sm">Call state:</span>
      <span className="text-xl font-extrabold leading-none tracking-wide font-stretch-condensed">
        {state ? state.toUpperCase() : 'none yet'}
      </span>
      <span className="text-sm opacity-80">(voice authenticity)</span>
    </span>
  )
}

// identity = ClipResult.identity or the latest Say-It-Back speaker.decision (Eidos).
export function IdentityBadge({ identity }) {
  const s = IDENTITY_STYLE[identity] ?? NONE
  return (
    <span key={identity ?? 'none'} className={`${PILL} text-sm font-semibold ${s.pill}`}
      title="Identity = Eidos voice match against the claimed customer (only checked at Say-It-Back or the first clip)">
      <span className={`${DOT} ${s.dot}`} />
      Identity: {IDENTITY_TEXT[identity] ?? 'no result yet'}
    </span>
  )
}
