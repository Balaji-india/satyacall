// /agent — bank agent console (B4, main demo screen). Three zones:
//   top: phone line (go online / outbound / answer / hang up) + top bar (customer, call state,
//        identity, credits) · centre: trust timeline · right: customer request panel
//   bottom: evidence drawer.
// Goes online as peer "satyacall-agent-desk", answers customers' calls (or calls one outbound),
// and monitors the call. Every value shown comes from a backend response.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Activity, ListChecks, PhoneOutgoing, Wifi } from 'lucide-react'
import CallPanel from '../components/CallPanel'
import ClipList from '../components/ClipList'
import EvidenceDrawer from '../components/EvidenceDrawer'
import RequestPanel from '../components/RequestPanel'
import TopBar from '../components/TopBar'
import TrustTimeline from '../components/TrustTimeline'
import { AGENT_PEER_ID, customerPeerId } from '../peer'
import { useCalmWhile } from '../effects'
import { realHuman } from '../explain'
import { useMonitoring } from '../useMonitoring'
import { usePeerCall } from '../usePeerCall'

const CLIP_TOAST = { green: toast.success, amber: toast.warning, red: toast.error }

export default function AgentPage() {
  const call = usePeerCall()
  // Records call.remoteStream = the CUSTOMER's voice as received over the call, never our mic.
  const m = useMonitoring(call.remoteStream)
  const [customerId, setCustomerId] = useState('')
  const online = call.status !== 'offline' && call.status !== 'connecting'
  useCalmWhile(m.phase === 'live') // recording clips → background animation off (visual only)

  // One action ends both: "End call" and "Hang up" stop monitoring (POST /end) AND close the
  // PeerJS call. m.end() marks the call as ending first, so no clip is uploaded after it.
  const endEverything = () => {
    m.end()
    call.hangUp()
  }

  // Toasts (display only): one per clip result / failed upload, text from the real response.
  const toasted = useRef(new Set())
  useEffect(() => {
    for (const row of m.rows) {
      const id = `${row.key}:${row.result ? 'result' : row.state}`
      if (toasted.current.has(id)) continue
      const title = `Clip ${row.t_start}–${row.t_end} s`
      if (row.result) {
        toasted.current.add(id)
        const r = row.result
        if (r.status === 'skipped') toast(`${title} skipped`, { description: 'Too little speech — free, not scored.' })
        else {
          const a = realHuman(r.authenticity)
          ;(CLIP_TOAST[r.status] ?? toast)(`${title} analysed: ${a.word}`, { description: `${a.metric} · call state ${r.call_state}` })
        }
      } else if (row.state === 'error') {
        toasted.current.add(id)
        toast.error(`${title} upload failed`, { description: row.error })
      } else if (row.state === 'skipped') {
        toasted.current.add(id)
        toast(`${title} skipped`, { description: row.error })
      }
    }
  }, [m.rows])
  useEffect(() => { if (m.error) toast.error('Monitoring error', { description: m.error }) }, [m.error])

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-bold text-white">Agent console</h1>
        {!m.callId && (
          <p className="text-base text-muted">Go online, connect a call, then start monitoring to fill the trust timeline.</p>
        )}
      </div>

      {/* Top zone, part 1: the phone line. */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="label">Phone line</p>
          {!online ? (
            <button onClick={() => call.goOnline(AGENT_PEER_ID)} disabled={call.status === 'connecting'}
              className="btn-primary px-4 py-2.5 text-base">
              <Wifi aria-hidden="true" className="h-4 w-4" />
              {call.status === 'connecting' ? 'Going online…' : <>Go online as <span className="font-mono font-medium">{AGENT_PEER_ID}</span></>}
            </button>
          ) : (
            <form className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); call.callPeer(customerPeerId(customerId.trim())) }}>
              <label className="sr-only" htmlFor="outbound">Outbound call — customer id</label>
              <input id="outbound" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                placeholder="customer id, e.g. C001" className="w-56 rounded-lg border border-line bg-field px-3 py-2 font-mono text-base" />
              <button disabled={!customerId.trim() || call.status === 'ringing' || call.status === 'in-call'}
                className="btn-primary px-4 py-2.5 text-base">
                <PhoneOutgoing aria-hidden="true" className="h-4 w-4" />
                {call.status === 'ringing' && call.direction === 'outbound'
                  ? `Calling ${call.otherId}…` : 'Call outbound'}
              </button>
            </form>
          )}
        </div>
        <span aria-hidden="true" className="hidden h-8 w-px bg-line lg:block" />
        <div className="min-w-0 flex-1">
          <CallPanel call={call} onHangUp={endEverything} />
        </div>
      </div>

      {/* Top zone, part 2: customer · call state · identity · credits. */}
      <TopBar call={call} m={m} onEnd={endEverything} />

      {/* Centre: trust timeline · right: request panel. */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="card min-w-0 space-y-4 p-5 lg:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Activity aria-hidden="true" className="h-5 w-5 text-tide" />Trust timeline
            </h2>
            <span className="text-[15px] text-muted">one bar per 10 s clip · Aletheia AI score</span>
          </div>
          <TrustTimeline rows={m.rows} />
          {m.rows.length > 0 && (
            <details className="group rounded-xl border border-line bg-inset">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-base font-semibold">
                <ListChecks aria-hidden="true" className="h-4 w-4 text-muted" />Clip list
                <span className="font-mono text-muted">({m.rows.length})</span>
              </summary>
              <div className="border-t border-line p-3"><ClipList rows={m.rows} /></div>
            </details>
          )}
        </div>
        {/* key: a new call starts with an empty request panel */}
        <div className="min-w-0 lg:col-span-4">
          <RequestPanel key={m.callId ?? 'none'} m={m} remoteStream={call.remoteStream} />
        </div>
      </div>

      {/* Bottom: evidence drawer. */}
      <EvidenceDrawer m={m} />
    </section>
  )
}
