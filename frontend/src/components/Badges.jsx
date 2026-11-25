// Badges — call state (VERIFYING / VERIFIED / WATCH / ALERT) and the separate IDENTITY badge.
// Colour always comes with a text label, never colour alone.

const STATE_STYLE = {
  verifying: 'bg-slate-200 text-slate-800',
  verified: 'bg-green-600 text-white',
  watch: 'bg-amber-400 text-black',
  alert: 'bg-red-600 text-white',
}

const IDENTITY_STYLE = {
  match: 'bg-green-600 text-white',
  no_match: 'bg-red-600 text-white',
  not_checked: 'bg-slate-200 text-slate-800',
}

const IDENTITY_TEXT = { match: 'match', no_match: 'no match', not_checked: 'not checked' }

// state = the backend's call_state (null before the first result).
export function StateBadge({ state }) {
  return (
    <span className={`rounded px-3 py-1 text-sm font-bold uppercase ${STATE_STYLE[state] ?? 'bg-slate-100 text-slate-500'}`}
      title="Call state = voice authenticity over the call (Aletheia)">
      {state ?? 'no state yet'}
    </span>
  )
}

// identity = ClipResult.identity or the latest Say-It-Back speaker.decision (Eidos).
export function IdentityBadge({ identity }) {
  return (
    <span className={`rounded px-3 py-1 text-sm font-semibold ${IDENTITY_STYLE[identity] ?? 'bg-slate-100 text-slate-500'}`}
      title="Identity = Eidos voice match against the claimed customer (only checked at Say-It-Back or the first clip)">
      IDENTITY: {IDENTITY_TEXT[identity] ?? 'no result yet'}
    </span>
  )
}
