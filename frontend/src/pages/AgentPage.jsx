// /agent — bank agent desk. Goes online as peer "satyacall-agent-desk", answers customers'
// calls, can call a customer outbound (peer "satyacall-customer-<id>"), and monitors the call (B3).
import { useState } from 'react'
import CallPanel from '../components/CallPanel'
import MonitorPanel from '../components/MonitorPanel'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { usePeerCall } from '../usePeerCall'

export default function AgentPage() {
  const call = usePeerCall()
  const [customerId, setCustomerId] = useState('')
  const online = call.status !== 'offline' && call.status !== 'connecting'

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Agent console</h1>

      {!online && (
        <button onClick={() => call.goOnline(AGENT_PEER_ID)} disabled={call.status === 'connecting'}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
          Go online as {AGENT_PEER_ID}
        </button>
      )}

      {online && (
        <form className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); call.callPeer(customerPeerId(customerId.trim())) }}>
          <label className="text-sm text-slate-600" htmlFor="outbound">Outbound call — customer id</label>
          <input id="outbound" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            placeholder="e.g. C001" className="rounded border px-2 py-1" />
          <button disabled={!customerId.trim() || call.status === 'ringing' || call.status === 'in-call'}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
            Call {customerPeerId(customerId.trim() || '…')}
          </button>
        </form>
      )}

      <CallPanel call={call} />
      <MonitorPanel call={call} />
    </section>
  )
}
