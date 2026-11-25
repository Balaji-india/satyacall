// TopBar — top of /agent: claimed customer + agent id, Start / End call, call state badge,
// identity badge, credits (big), Pause monitoring, last-clip download, and the ALERT banner.
// call = usePeerCall(), m = useMonitoring(), onEnd = ends monitoring AND hangs up.
import { useEffect, useState } from 'react'
import { errorText, listPeople } from '../api'
import { CLIP_SECONDS } from '../clipRecorder'
import { customerPeerId } from '../peer'
import { IdentityBadge, StateBadge } from './Badges'

export default function TopBar({ call, m, onEnd }) {
  const [typedCustomerId, setCustomerId] = useState(null) // null = not chosen by hand yet
  const [agentId, setAgentId] = useState('')
  // GET /api/people → enrolled customers. null = loading; on error or an empty list → text input.
  const [customers, setCustomers] = useState(null)
  const [peopleError, setPeopleError] = useState('')

  useEffect(() => {
    listPeople()
      .then((people) => setCustomers((Array.isArray(people) ? people : []).filter((p) => p.role === 'customer')))
      .catch((err) => { setCustomers([]); setPeopleError(errorText(err)) })
  }, [])

  // Outbound call to "satyacall-customer-<id>" → that <id> is the claimed customer (same id the
  // call log stores, and the one the customer's /app sends). The agent can still change it.
  const prefix = customerPeerId('')
  const outboundCustomer = call.direction === 'outbound' && call.otherId.startsWith(prefix)
    ? call.otherId.slice(prefix.length) : ''
  const customerId = typedCustomerId ?? outboundCustomer

  // Only a call WE placed from the "Outbound call" box is outbound; answered calls stay inbound.
  const direction = call.direction === 'outbound' ? 'outbound' : 'inbound'

  const inCall = call.status === 'in-call'
  const live = m.phase === 'live'
  const canStart = inCall && (m.phase === 'idle' || m.phase === 'ended')
  const useSelect = customers?.length > 0

  const onStart = (e) => {
    e.preventDefault()
    m.start({ direction, claimed_customer_id: customerId.trim(), agent_id: agentId.trim() })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 p-3">
        {/* Who the caller claims to be + which agent → POST /api/calls */}
        {(m.phase === 'idle' || m.phase === 'ended' || m.phase === 'starting') && (
          <form onSubmit={onStart} className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="claimed" className="text-slate-600">Claimed customer</label>
            {useSelect ? (
              <select id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="rounded border bg-white px-2 py-1">
                <option value="">choose…</option>
                {customers.map((p) => (
                  <option key={p.person_id} value={p.person_id}>{p.display_name} ({p.person_id})</option>
                ))}
              </select>
            ) : (
              <input id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                placeholder="cust-balaji" className="rounded border px-2 py-1"
                title={customers === null ? 'Loading customers…' : peopleError
                  ? `Could not load customers (${peopleError}) — type the id` : 'No enrolled customers — type the id'} />
            )}
            {/* The call log stores this exactly as typed; the customer's /app types the same
                employee ID, so use the bare number (e.g. 4521), not the speaker id emp-4521. */}
            <label htmlFor="agent" className="text-slate-600">Employee ID</label>
            <input id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}
              placeholder="4521" className="w-28 rounded border px-2 py-1" />
            <button disabled={!canStart || !customerId.trim() || !agentId.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
              {m.phase === 'starting' ? 'Starting…' : 'Start monitoring'}
            </button>
            {inCall && <span className="text-slate-500">{direction}{direction === 'outbound' && ' (writes bank call log)'}</span>}
            {!inCall && <span className="text-slate-500">connect a call first</span>}
          </form>
        )}

        {m.callId && (
          <>
            <span className="font-mono text-sm text-slate-500">call {m.callId}</span>
            <span className="text-sm text-slate-500">
              {m.direction === 'outbound' ? 'outbound — logged' : m.direction}
            </span>
            <StateBadge state={m.callState} />
            <IdentityBadge identity={m.identity} />
          </>
        )}

        {/* Credits: last balance the backend reported (DetectifAI's real number). */}
        <div className="ml-auto text-right">
          <div className="text-xs uppercase text-slate-500">DetectifAI credits</div>
          <div className="text-2xl font-bold tabular-nums">{m.credits ?? '—'}</div>
        </div>
      </div>

      {peopleError && !m.callId && (
        <p className="text-xs text-slate-500">Customer list unavailable ({peopleError}) — type the customer id instead.</p>
      )}

      {m.callId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={m.togglePause} disabled={!live || m.holding}
            className={`rounded px-4 py-2 disabled:opacity-40 ${m.paused ? 'bg-amber-400' : 'border'}`}>
            {m.paused ? 'Resume monitoring' : 'Pause monitoring'}
          </button>
          <button onClick={onEnd} disabled={!live}
            className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-40">
            {m.phase === 'ending' ? 'Ending…' : 'End call'}
          </button>
          <button onClick={() => downloadClip(m.lastClip)} disabled={!m.lastClip}
            className="rounded border px-4 py-2 disabled:opacity-40">
            Download last clip{m.lastClip ? ` (${m.lastClip.t_start}–${m.lastClip.t_end} s)` : ''}
          </button>
          <span className="text-slate-500">
            {live && (m.holding ? 'timeline paused for Say-It-Back'
              : m.paused ? 'paused — not recording (saves credits)'
              : `recording ${CLIP_SECONDS} s clips of the customer`)}
            {m.phase === 'ending' && 'ending — finishing queued uploads…'}
            {m.phase === 'ended' && 'call ended'}
            {' · '}live updates: {m.wsStatus || 'connecting…'}
          </span>
        </div>
      )}

      {m.callState === 'alert' && (
        <div className="rounded bg-red-600 p-3 text-white">
          <p className="text-lg font-bold">ALERT: Possible handover / voice change</p>
          {m.stateReason && <p className="text-sm">Evidence: {m.stateReason}</p>}
          <p className="text-sm">
            Next step: every request now needs Say-It-Back. If it fails, do not proceed — use the bank's
            existing OTP to the registered number, or call back on the number on file.
          </p>
        </div>
      )}

      {m.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{m.error}</p>}
    </div>
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
