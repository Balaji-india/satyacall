// Badges — call state (VERIFYING / VERIFIED / WATCH / ALERT) and the separate identity badge.
// Colour always comes with a text label, never colour alone.
// The two look deliberately different: call state is a rubber STAMP, identity is a filled pill.

// Ink colour of the stamp per state (its text and double border both use currentColor).
const STATE_STYLE = {
  verifying: 'text-ink/60',
  verified: 'text-pass',
  watch: 'text-warn',
  alert: 'text-stop',
}

const IDENTITY_STYLE = {
  match: 'bg-pass text-white',
  no_match: 'bg-stop text-white',
  not_checked: 'bg-ink/10 text-ink',
}

const IDENTITY_TEXT = { match: 'match', no_match: 'no match', not_checked: 'not checked' }

// state = the backend's call_state (null before the first result).
// Reads "Call state: VERIFIED (voice authenticity)" so it is never taken for the identity badge.
// key={state}: React re-mounts the stamp when the state changes, so it "lands" again only then.
export function StateBadge({ state }) {
  return (
    <span key={state ?? 'none'} className={`stamp bg-white px-3 py-1 ${STATE_STYLE[state] ?? 'text-ink/50'}`}
      title="Call state = voice authenticity over the call (Aletheia: real human voice or AI-generated?)">
      <span className="text-sm">Call state:</span>
      <span className="text-xl font-extrabold leading-none tracking-wide font-stretch-condensed">
        {state ? state.toUpperCase() : 'none yet'}
      </span>
      <span className="text-xs">(voice authenticity)</span>
    </span>
  )
}

// identity = ClipResult.identity or the latest Say-It-Back speaker.decision (Eidos).
export function IdentityBadge({ identity }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${IDENTITY_STYLE[identity] ?? 'bg-ink/10 text-ink/60'}`}
      title="Identity = Eidos voice match against the claimed customer (only checked at Say-It-Back or the first clip)">
      Identity: {IDENTITY_TEXT[identity] ?? 'no result yet'}
    </span>
  )
}
