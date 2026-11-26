// Call bank tab of /customer (was /call) — the customer's phone (simple view, big buttons). Goes online as
// "satyacall-customer-<id>" (so the agent can call outbound) and can "Call bank"
// (peer "satyacall-agent-desk").
// `call` = usePeerCall(), owned by CustomerApp (so the full-screen call screen and the
// "Return to call" bar can use it from either tab). Ringing / in a call → PhoneCallScreen
// covers this page; this page shows the line status, errors and the Go online / Call bank buttons.
import { useState } from 'react'
import { PhoneCall, Wifi } from 'lucide-react'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { getSession } from '../session'
import { formatClock } from '../useCallClock'

const BIG = 'w-full rounded-2xl py-4 text-lg font-semibold min-h-14'
const DOT = { offline: 'bg-skip', connecting: 'bg-warn ringing', online: 'bg-sea', ringing: 'bg-warn ringing', 'in-call': 'bg-sea live-dot', ended: 'bg-sea' }

function lineText(status, secs) {
  switch (status) {
    case 'connecting': return 'Going online…'
    case 'online': return 'Online — the bank can call you'
    case 'ringing': return 'Calling…'
    case 'in-call': return `In call · ${formatClock(secs)}`
    case 'ended': return secs > 0 ? `Call ended · ${formatClock(secs)}` : 'Call ended'
    default: return 'Offline'
  }
}

export default function CallPage({ call, secs }) {
  // Pre-set from the demo sign-in (B10); still editable.
  const [customerId, setCustomerId] = useState(() => getSession()?.person_id ?? '')
  const connecting = call.status === 'connecting'
  const online = call.status !== 'offline' && !connecting
  const busy = call.status === 'ringing' || call.status === 'in-call'
  const firstName = getSession()?.display_name?.split(' ')[0]

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-fg">{firstName ? `Hi ${firstName}` : 'Call your bank'}</h1>
        <p className="text-base text-muted">Talk to SatyaBank customer care.</p>
      </div>

      <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-base font-medium text-fg ring-1 ring-line">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[call.status]}`} />
        <span className="break-words">{lineText(call.status, secs)}</span>
        {call.myId && <span className="truncate font-mono text-sm text-muted">{call.myId.replace('satyacall-customer-', '')}</span>}
      </p>

      {call.error && (
        <p role="alert" className="break-words rounded-xl border border-stop/40 bg-stop/10 p-3 text-base text-stop-fg">{call.error}</p>
      )}

      {!online && (
        <form className="card space-y-3 p-4"
          onSubmit={(e) => { e.preventDefault(); call.goOnline(customerPeerId(customerId.trim())) }}>
          <label className="label block" htmlFor="cid">Your customer ID</label>
          <input id="cid" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={connecting}
            placeholder="e.g. C001" className="field font-mono text-lg" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
          <p className="text-base text-muted">Go online first — then you can call the bank, and the bank can call you.</p>
          <button disabled={!customerId.trim() || connecting} className={`${BIG} btn-primary`}>
            <Wifi aria-hidden="true" className="h-5 w-5" />
            {connecting ? 'Going online…' : 'Go online'}
          </button>
        </form>
      )}

      {online && (
        <button onClick={() => call.callPeer(AGENT_PEER_ID)} disabled={busy}
          className={`${BIG} btn-go disabled:opacity-60`}>
          <PhoneCall aria-hidden="true" className="h-5 w-5" />
          {busy ? 'In call with the bank' : 'Call bank'}
        </button>
      )}

      {online && (
        <p className="text-base text-muted">Keep this app open — when the bank calls you, the phone rings here.</p>
      )}
    </section>
  )
}
