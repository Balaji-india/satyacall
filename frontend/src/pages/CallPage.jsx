// /call — the customer's phone (simple view, big buttons). Goes online as
// "satyacall-customer-<id>" (so the agent can call outbound) and can "Call bank"
// (peer "satyacall-agent-desk").
import { useState } from 'react'
import CallPanel from '../components/CallPanel'
import { usePeerCall } from '../usePeerCall'
import { AGENT_PEER_ID, customerPeerId } from '../peer'

const BIG = 'w-full rounded-xl py-4 text-lg font-semibold disabled:opacity-40'

export default function CallPage() {
  const call = usePeerCall()
  const [customerId, setCustomerId] = useState('')
  const connecting = call.status === 'connecting'
  const online = call.status !== 'offline' && !connecting

  const callLabel = call.status === 'in-call' ? 'In call with the bank'
    : call.status === 'ringing' ? (call.direction === 'inbound' ? 'The bank is calling…' : 'Calling the bank…')
    : 'Call bank'

  return (
    <section className="mx-auto max-w-[420px] space-y-5 rounded-2xl border bg-white p-4 sm:p-5">
      <h1 className="text-2xl font-bold">Call your bank</h1>

      {!online && (
        <form className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); call.goOnline(customerPeerId(customerId.trim())) }}>
          <label className="block text-sm font-medium" htmlFor="cid">Your customer id</label>
          <input id="cid" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={connecting}
            placeholder="e.g. C001" className="w-full rounded-lg border px-3 py-3 text-lg" />
          <p className="text-sm text-slate-600">Go online first — then you can call the bank, and the bank can call you.</p>
          <button disabled={!customerId.trim() || connecting} className={`${BIG} bg-slate-900 text-white`}>
            {connecting ? 'Going online…' : 'Go online'}
          </button>
        </form>
      )}

      {online && (
        <button onClick={() => call.callPeer(AGENT_PEER_ID)}
          disabled={call.status === 'ringing' || call.status === 'in-call'}
          className={`${BIG} bg-green-600 text-white`}>
          {callLabel}
        </button>
      )}

      <CallPanel call={call} big />
    </section>
  )
}
