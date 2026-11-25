// MonitorPanel — "Monitoring" section of /agent: start / pause / end, call state, credits,
// ALERT banner, last-clip download and the clip list. `call` = usePeerCall() of the agent.
import { useState } from 'react'
import { CLIP_SECONDS } from '../clipRecorder'
import { useMonitoring } from '../useMonitoring'
import ClipList from './ClipList'

const STATE_STYLE = {
  verifying: 'bg-slate-200 text-slate-800',
  verified: 'bg-green-600 text-white',
  watch: 'bg-amber-400 text-black',
  alert: 'bg-red-600 text-white',
}

export default function MonitorPanel({ call }) {
  // Records call.remoteStream = the CUSTOMER's voice as received over the call, never our mic.
  const m = useMonitoring(call.remoteStream)
  const [customerId, setCustomerId] = useState('')
  const [agentId, setAgentId] = useState('')

  const inCall = call.status === 'in-call'
  const canStart = inCall && (m.phase === 'idle' || m.phase === 'ended')
  const live = m.phase === 'live'

  if (!inCall && m.phase === 'idle') return null // section appears once a call is connected

  const onStart = (e) => {
    e.preventDefault()
    m.start({ claimed_customer_id: customerId.trim(), agent_id: agentId.trim() })
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Monitoring</h2>

      {canStart && (
        <form onSubmit={onStart} className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="claimed">Claimed customer id</label>
          <input id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            placeholder="cust-balaji" className="rounded border px-2 py-1" />
          <label htmlFor="agent">Agent id</label>
          <input id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}
            placeholder="emp-4521" className="rounded border px-2 py-1" />
          <button disabled={!customerId.trim() || !agentId.trim()}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
            Start monitoring
          </button>
        </form>
      )}
      {m.phase === 'starting' && <p className="text-sm">Creating the call on the backend…</p>}

      {m.callId && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-mono">call {m.callId}</span>
          <span className={`rounded px-2 py-0.5 font-semibold uppercase ${STATE_STYLE[m.callState] ?? 'bg-slate-100'}`}>
            {m.callState ?? 'no state yet'}
          </span>
          <span>
            credits: {m.latest ? (m.latest.credits_balance ?? 'unknown') : 'no clip result yet'}
          </span>
          <span className="text-slate-500">live updates: {m.wsStatus || 'connecting…'}</span>
          <span className="text-slate-500">
            {live && (m.paused ? 'paused — not recording' : `recording ${CLIP_SECONDS} s clips of the customer`)}
            {m.phase === 'ending' && 'ending — finishing queued uploads…'}
            {m.phase === 'ended' && 'call ended'}
          </span>
        </div>
      )}

      {m.callState === 'alert' && (
        <div className="rounded bg-red-600 p-3 text-white">
          <p className="font-bold">ALERT: Possible handover / voice change</p>
          {m.stateReason && <p className="text-sm">{m.stateReason}</p>}
          <p className="text-sm">Next step: don't approve sensitive requests on this call; call the customer back on the number on file.</p>
        </div>
      )}

      {m.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{m.error}</p>}

      {m.callId && (
        <div className="flex flex-wrap gap-2">
          <button onClick={m.togglePause} disabled={!live}
            className="rounded border px-4 py-2 disabled:opacity-40">
            {m.paused ? 'Resume monitoring' : 'Pause monitoring'}
          </button>
          <button onClick={m.end} disabled={!live}
            className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-40">
            End call
          </button>
          <button onClick={() => downloadClip(m.lastClip)} disabled={!m.lastClip}
            className="rounded border px-4 py-2 disabled:opacity-40">
            Download last clip{m.lastClip ? ` (${m.lastClip.t_start}–${m.lastClip.t_end} s)` : ''}
          </button>
        </div>
      )}

      {m.callId && <ClipList rows={m.rows} />}
    </section>
  )
}

// Save the Blob as a .webm file (proves the capture is real and complete).
function downloadClip({ blob, t_start, t_end }) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clip_${t_start}-${t_end}s.webm`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
