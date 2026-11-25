// Call bank tab of /customer (was /call) — the customer's phone (simple view, big buttons). Goes online as
// "satyacall-customer-<id>" (so the agent can call outbound) and can "Call bank"
// (peer "satyacall-agent-desk").
import { useState } from 'react'
import { PhoneCall, Wifi } from 'lucide-react'
import CallPanel from '../components/CallPanel'
import { usePeerCall } from '../usePeerCall'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { getSession } from '../session'

const BIG = 'w-full rounded-2xl py-4 text-lg font-semibold min-h-14'

export default function CallPage() {
  const call = usePeerCall()
  // Pre-set from the demo sign-in (B10); still editable.
  const [customerId, setCustomerId] = useState(() => getSession()?.person_id ?? '')
  const connecting = call.status === 'connecting'
  const online = call.status !== 'offline' && !connecting
  const firstName = getSession()?.display_name?.split(' ')[0]

  const callLabel = call.status === 'in-call' ? 'In call with the bank'
    : call.status === 'ringing' ? (call.direction === 'inbound' ? 'The bank is calling…' : 'Calling the bank…')
    : 'Call bank'

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-fg">{firstName ? `Hi ${firstName}` : 'Call your bank'}</h1>
        <p className="text-base text-muted">Talk to SatyaBank customer care.</p>
      </div>

      <CallPanel call={call} big>
        {!online && (
          <form className="card space-y-3 p-4"
            onSubmit={(e) => { e.preventDefault(); call.goOnline(customerPeerId(customerId.trim())) }}>
            <label className="label block" htmlFor="cid">Your customer ID</label>
            <input id="cid" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={connecting}
              placeholder="e.g. C001" className="field font-mono text-lg" />
            <p className="text-base text-muted">Go online first — then you can call the bank, and the bank can call you.</p>
            <button disabled={!customerId.trim() || connecting} className={`${BIG} btn-primary`}>
              <Wifi aria-hidden="true" className="h-5 w-5" />
              {connecting ? 'Going online…' : 'Go online'}
            </button>
          </form>
        )}

        {online && (
          <button onClick={() => call.callPeer(AGENT_PEER_ID)}
            disabled={call.status === 'ringing' || call.status === 'in-call'}
            className={`${BIG} btn-go disabled:opacity-60`}>
            <PhoneCall aria-hidden="true" className="h-5 w-5" />
            {callLabel}
          </button>
        )}
      </CallPanel>
    </section>
  )
}
