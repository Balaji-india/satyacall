// /call — the customer's phone. Goes online as "satyacall-customer-<id>" (so the agent can call
// outbound) and can "Call bank" (peer "satyacall-agent-desk").
import { useState } from 'react'
import CallPanel from '../components/CallPanel'
import { usePeerCall } from '../usePeerCall'
import { AGENT_PEER_ID, customerPeerId } from '../peer'

export default function CallPage() {
  const call = usePeerCall()
  const [customerId, setCustomerId] = useState('')
  const online = call.status !== 'offline' && call.status !== 'connecting'
  const busy = call.status === 'ringing' || call.status === 'in-call'

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Customer call</h1>

      {!online && (
        <form className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); call.goOnline(customerPeerId(customerId.trim())) }}>
          <label className="text-sm text-slate-600" htmlFor="cid">Your customer id</label>
          <input id="cid" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            placeholder="e.g. C001" className="rounded border px-2 py-1" />
          <button disabled={!customerId.trim() || call.status === 'connecting'}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
            Go online
          </button>
        </form>
      )}

      {online && (
        <button onClick={() => call.callPeer(AGENT_PEER_ID)} disabled={busy}
          className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-40">
          Call bank
        </button>
      )}

      <CallPanel call={call} />
    </section>
  )
}
