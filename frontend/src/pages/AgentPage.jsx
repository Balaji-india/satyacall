// /agent — bank agent console (B4, main demo screen).
// Goes online as peer "satyacall-agent-desk", answers customers' calls (or calls one outbound),
// and monitors the call: top bar · trust timeline + clip list · request panel · evidence drawer.
import { useState } from 'react'
import CallPanel from '../components/CallPanel'
import ClipList from '../components/ClipList'
import EvidenceDrawer from '../components/EvidenceDrawer'
import RequestPanel from '../components/RequestPanel'
import TopBar from '../components/TopBar'
import TrustTimeline from '../components/TrustTimeline'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { useMonitoring } from '../useMonitoring'
import { usePeerCall } from '../usePeerCall'

export default function AgentPage() {
  const call = usePeerCall()
  // Records call.remoteStream = the CUSTOMER's voice as received over the call, never our mic.
  const m = useMonitoring(call.remoteStream)
  const [customerId, setCustomerId] = useState('')
  const online = call.status !== 'offline' && call.status !== 'connecting'

  // One action ends both: "End call" and "Hang up" stop monitoring (POST /end) AND close the
  // PeerJS call. m.end() marks the call as ending first, so no clip is uploaded after it.
  const endEverything = () => {
    m.end()
    call.hangUp()
  }

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Agent console</h1>
      {!m.callId && (
        <p className="text-sm text-slate-600">
          Go online to take customer calls (or call one outbound). Once connected, start monitoring to see the trust timeline.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {!online && (
          <button onClick={() => call.goOnline(AGENT_PEER_ID)} disabled={call.status === 'connecting'}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
            {call.status === 'connecting' ? 'Going online…' : `Go online as ${AGENT_PEER_ID}`}
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
              {call.status === 'ringing' && call.direction === 'outbound'
                ? `Calling ${call.otherId}…` : `Call ${customerPeerId(customerId.trim() || '…')}`}
            </button>
          </form>
        )}
        <CallPanel call={call} onHangUp={endEverything} />
      </div>

      {online && <TopBar call={call} m={m} onEnd={endEverything} />}

      {m.callId && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-lg font-semibold">Trust timeline</h2>
            <TrustTimeline rows={m.rows} />
            <details>
              <summary className="cursor-pointer text-sm text-slate-600">Clip list ({m.rows.length})</summary>
              <div className="mt-2"><ClipList rows={m.rows} /></div>
            </details>
          </div>
          {/* key: a new call starts with an empty request panel */}
          <RequestPanel key={m.callId} m={m} remoteStream={call.remoteStream} />
        </div>
      )}

      <EvidenceDrawer m={m} />
    </section>
  )
}
