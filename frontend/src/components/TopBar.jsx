// TopBar — top of /agent: claimed customer + agent id, Start / End call, call state badge,
// identity badge, credits (big), Pause monitoring, last-clip download, the ALERT banner and
// the identity "no match" banner.
// call = usePeerCall(), m = useMonitoring(), onEnd = ends monitoring AND hangs up.
import { useEffect, useState } from 'react'
import { errorText, listPeople } from '../api'
import { CLIP_SECONDS } from '../clipRecorder'
import { customerPeerId } from '../peer'
import { IdentityBadge, StateBadge } from './Badges'
import { AlertIcon } from './Icons'

export default function TopBar({ call, m, onEnd }) {
  const [typedCustomerId, setCustomerId] = useState(null) // null = not chosen by hand yet
  const [agentId, setAgentId] = useState('')
  // GET /api/people → enrolled customers. null = loading; on error or an empty list → text input.
  const [customers, setCustomers] = useState(null)
  const [peopleError, setPeopleError] = useState('')
  const [startedCustomerId, setStartedCustomerId] = useState('') // claimed customer of the current call

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
    setStartedCustomerId(customerId.trim())
    m.start({ direction, claimed_customer_id: customerId.trim(), agent_id: agentId.trim() })
  }

  return (
    <div className="space-y-3">
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        {/* Who the caller claims to be + which agent → POST /api/calls */}
        {(m.phase === 'idle' || m.phase === 'ended' || m.phase === 'starting') && (
          <form onSubmit={onStart} className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="claimed" className="text-slate-600">Claimed customer</label>
            {useSelect ? (
              <select id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                disabled={m.phase === 'starting'} className="rounded-lg border px-2 py-1.5">
                <option value="">choose…</option>
                {customers.map((p) => (
                  <option key={p.person_id} value={p.person_id}>{p.display_name} ({p.person_id})</option>
                ))}
              </select>
            ) : (
              <input id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                disabled={m.phase === 'starting'} placeholder="cust-balaji" className="rounded-lg border px-2 py-1.5"
                title={customers === null ? 'Loading customers…' : peopleError
                  ? `Could not load customers (${peopleError}) — type the id` : 'No enrolled customers — type the id'} />
            )}
            {/* The call log stores this exactly as typed; the customer's /app types the same
                employee ID, so use the bare number (e.g. 4521), not the speaker id emp-4521. */}
            <label htmlFor="agent" className="text-slate-600">Employee ID</label>
            <input id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}
              disabled={m.phase === 'starting'} placeholder="4521" className="w-28 rounded-lg border px-2 py-1.5" />
            <button disabled={!canStart || !customerId.trim() || !agentId.trim()}
              className="btn-primary px-4 py-2 disabled:opacity-40 disabled:shadow-none">
              {m.phase === 'starting' ? 'Starting…' : 'Start monitoring'}
            </button>
            {inCall && <span className="text-slate-500">{direction}{direction === 'outbound' && ' (writes bank call log)'}</span>}
            {!inCall && <span className="text-slate-500">connect a call first</span>}
          </form>
        )}

        {m.callId && (
          <>
            {live && (
              <span className="inline-flex items-center gap-2 rounded-full border border-stop/60 bg-stop/15 px-3 py-1 text-sm font-bold tracking-wider text-red-700">
                <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-stop" />LIVE
              </span>
            )}
            <span className="font-mono text-sm text-slate-500">call {m.callId}</span>
            <span className="text-sm text-slate-500">
              {m.direction === 'outbound' ? 'outbound — logged' : m.direction}
            </span>
            <StateBadge state={m.callState} />
            <IdentityBadge identity={m.identity} />
          </>
        )}

        {/* Credits: last balance the backend reported (DetectifAI's real number). */}
        <div className="ml-auto rounded-xl border border-stamp/40 bg-stamp/10 px-4 py-2 text-right glow-stamp">
          <div className="text-sm text-slate-600">DetectifAI credits</div>
          <div className="text-glow text-3xl font-bold leading-tight tabular-nums">{m.credits ?? '—'}</div>
        </div>
      </div>

      {peopleError && !m.callId && (
        <p className="text-sm text-slate-500">Customer list unavailable ({peopleError}) — type the customer id instead.</p>
      )}

      {m.callId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={m.togglePause} disabled={!live || m.holding}
            className={`rounded-xl px-4 py-2 font-semibold disabled:opacity-40 ${m.paused ? 'bg-warn text-slate-950 glow-warn' : 'border bg-white/5'}`}>
            {m.paused ? 'Resume monitoring' : 'Pause monitoring'}
          </button>
          <button onClick={onEnd} disabled={!live}
            className="rounded-xl bg-stop px-4 py-2 font-semibold text-white glow-stop disabled:opacity-40 disabled:shadow-none">
            {m.phase === 'ending' ? 'Ending…' : 'End call'}
          </button>
          <button onClick={() => downloadClip(m.lastClip)} disabled={!m.lastClip}
            className="rounded-xl border bg-white/5 px-4 py-2 disabled:opacity-40">
            Download last clip{m.lastClip ? ` (${m.lastClip.t_start}–${m.lastClip.t_end} s)` : ''}
          </button>
          <span className="text-slate-500">
            {live && (m.holding ? 'timeline paused for Say-It-Back'
              : m.paused ? 'paused — not recording (saves credits)'
              : `recording ${CLIP_SECONDS} s clips of the customer`)}
            {m.phase === 'ending' && 'ending — finishing queued uploads…'}
            {m.phase === 'ended' && 'call ended'}
            {' · '}live updates: {wsText(m.wsStatus, live)}
          </span>
        </div>
      )}

      {m.callState === 'alert' && (
        <div className="alert-pulse flex gap-4 rounded-2xl border border-white/20 bg-stop p-4 text-white">
          <AlertIcon className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
          <p className="text-xl font-bold">ALERT: Possible handover / voice change</p>
          {m.stateReason && <p className="text-sm">Evidence: {m.stateReason}</p>}
          <p className="text-sm">
            Next step: every request now needs Say-It-Back. If it fails, do not proceed — use the bank's
            existing OTP to the registered number, or call back on the number on file.
          </p>
          </div>
        </div>
      )}

      {/* Identity = Eidos said this is NOT the claimed customer's voice. Name comes from
          GET /api/people; if the list did not load we show the id instead (never a made-up name). */}
      {m.callId && m.identity === 'no_match' && (
        <div className="alert-pulse flex gap-4 rounded-2xl border border-white/20 bg-stop p-4 text-white">
          <AlertIcon className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
          <p className="text-xl font-bold">
            Caller's voice does not match {customers?.find((p) => p.person_id === startedCustomerId)?.display_name ?? startedCustomerId}.
            Do not proceed with high-risk requests.
          </p>
          <p className="text-sm">
            Next step: use the bank's existing OTP to the registered number, or call back on the number on file.
          </p>
          </div>
        </div>
      )}

      {m.error && <p className="rounded-xl border border-stop/50 bg-red-50 p-3 text-sm text-red-700">{m.error}</p>}
    </div>
  )
}

// WebSocket status → words. Without it, results still arrive in each clip's HTTP response.
function wsText(status, live) {
  if (status === 'open') return 'connected'
  if (!status) return 'connecting…'
  return live ? 'lost — results still arrive over HTTP' : 'closed'
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
