// Call bank tab of /customer (was /call) — the customer's phone (simple view, big buttons). Goes online as
// "satyacall-customer-<id>" (so the agent can call outbound) and can "Call bank"
// (peer "satyacall-agent-desk").
import { useState } from 'react'
import CallPanel from '../components/CallPanel'
import { usePeerCall } from '../usePeerCall'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { getSession } from '../session'

const BIG = 'w-full rounded-2xl py-5 text-xl font-semibold transition disabled:opacity-40 disabled:shadow-none'

export default function CallPage() {
  const call = usePeerCall()
  // Pre-set from the demo sign-in (B10); still editable.
  const [customerId, setCustomerId] = useState(() => getSession()?.person_id ?? '')
  const connecting = call.status === 'connecting'
  const online = call.status !== 'offline' && !connecting

  const callLabel = call.status === 'in-call' ? 'In call with the bank'
    : call.status === 'ringing' ? (call.direction === 'inbound' ? 'The bank is calling…' : 'Calling the bank…')
    : 'Call bank'

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Call your bank</h1>

      {!online && (
        <form className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); call.goOnline(customerPeerId(customerId.trim())) }}>
          <label className="block text-sm font-medium" htmlFor="cid">Your customer id</label>
          <input id="cid" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={connecting}
            placeholder="e.g. C001" className="w-full rounded-xl border px-4 py-3 text-lg" />
          <p className="text-sm text-slate-600">Go online first — then you can call the bank, and the bank can call you.</p>
          <button disabled={!customerId.trim() || connecting} className={`${BIG} btn-primary glow-stamp`}>
            {connecting ? 'Going online…' : 'Go online'}
          </button>
        </form>
      )}

      {online && (
        <button onClick={() => call.callPeer(AGENT_PEER_ID)}
          disabled={call.status === 'ringing' || call.status === 'in-call'}
          className={`${BIG} bg-pass text-white glow-pass`}>
          {callLabel}
        </button>
      )}

      <CallPanel call={call} big />
    </section>
  )
}
