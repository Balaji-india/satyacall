// Badges — call state (VERIFYING / VERIFIED / WATCH / ALERT) and the separate identity badge.
// Icon + word + colour, never colour alone. Each has its own label ("Call state · voice
// authenticity" vs "Identity · Eidos") so the two are never confused. The pill animates in again
// only when its value changes (Pill swapKey).
import { Pill } from './Tone'

const STATE_TONE = { verifying: 'skip', verified: 'pass', watch: 'warn', alert: 'stop' }
const IDENTITY_TONE = { match: 'pass', no_match: 'stop', not_checked: 'skip' }
const IDENTITY_TEXT = { match: 'Match', no_match: 'No match', not_checked: 'Not checked' }

function Labelled({ label, sub, title, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5" title={title}>
      <span className="label">{label} <span className="opacity-80">· {sub}</span></span>
      <div className="flex">{children}</div>
    </div>
  )
}

// state = the backend's call_state (null before the first result).
export function StateBadge({ state }) {
  return (
    <Labelled label="Call state" sub="voice authenticity"
      title="Call state = voice authenticity over the call (Aletheia: real human voice or AI-generated?)">
      <Pill tone={STATE_TONE[state] ?? 'skip'} swapKey={state ?? 'none'} className={`text-lg tracking-wide ${state === 'alert' ? 'rec-ring' : ''}`}>
        {state ? state.toUpperCase() : 'None yet'}
      </Pill>
    </Labelled>
  )
}

// identity = ClipResult.identity or the latest Say-It-Back speaker.decision (Eidos).
export function IdentityBadge({ identity }) {
  return (
    <Labelled label="Identity" sub="Eidos voice match"
      title="Identity = Eidos voice match against the claimed customer (only checked at Say-It-Back or the first clip)">
      <Pill tone={IDENTITY_TONE[identity] ?? 'skip'} swapKey={identity ?? 'none'} className="text-lg">
        {IDENTITY_TEXT[identity] ?? 'No result yet'}
      </Pill>
    </Labelled>
  )
}
