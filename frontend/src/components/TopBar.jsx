// TopBar — top of /agent: claimed customer + agent id, Start / End call, call state badge,
// identity badge, credits (big), Pause monitoring, last-clip download, the ALERT banner and
// the identity "no match" banner.
// call = usePeerCall(), m = useMonitoring(), onEnd = ends monitoring AND hangs up.
import { useEffect, useState } from 'react'
import { errorText, listPeople } from '../api'
import { CLIP_SECONDS } from '../clipRecorder'
import { customerPeerId } from '../peer'
import { getSession } from '../session'
import { IdentityBadge, StateBadge } from './Badges'
import { AlertTriangle, Coins, Download, Pause, Play, PhoneOff, Radio, UserRound } from 'lucide-react'
import { Reveal } from './Tone'

export default function TopBar({ call, m, onEnd }) {
  const [typedCustomerId, setCustomerId] = useState(null) // null = not chosen by hand yet
  // Pre-set from the staff sign-in (B10): the bare employee ID; still editable.
  const [agentId, setAgentId] = useState(() => getSession()?.employee_id ?? '')
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

  const field = 'rounded-lg border border-line bg-field px-3 py-2 text-base'
  const startedName = customers?.find((p) => p.person_id === startedCustomerId)?.display_name

  return (
    <div className="space-y-3">
      <div className="card p-5">
        <div className="grid items-end gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          {/* Who the caller claims to be + which agent → POST /api/calls */}
          {(m.phase === 'idle' || m.phase === 'ended' || m.phase === 'starting') ? (
            <form onSubmit={onStart} className="flex min-w-0 flex-wrap items-end gap-3">
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <label htmlFor="claimed" className="label">Claimed customer</label>
                {useSelect ? (
                  <select id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                    disabled={m.phase === 'starting'} className={field}>
                    <option value="">choose…</option>
                    {customers.map((p) => (
                      <option key={p.person_id} value={p.person_id}>{p.display_name} ({p.person_id})</option>
                    ))}
                  </select>
                ) : (
                  <input id="claimed" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                    disabled={m.phase === 'starting'} placeholder="e.g. cust-balaji" className={`${field} font-mono`}
                    title={customers === null ? 'Loading customers…' : peopleError
                      ? `Could not load customers (${peopleError}) — type the id` : 'No enrolled customers — type the id'} />
                )}
              </div>
              {/* The call log stores this exactly as typed; the customer's /app types the same
                  employee ID, so use the bare number (e.g. 4521), not the speaker id emp-4521. */}
              <div className="flex w-32 flex-col gap-1.5">
                <label htmlFor="agent" className="label">Employee ID</label>
                <input id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}
                  disabled={m.phase === 'starting'} placeholder="e.g. 4521" className={`${field} font-mono`} />
              </div>
              <button disabled={!canStart || !customerId.trim() || !agentId.trim()} className="btn-primary px-5 py-2.5 text-base">
                <Radio aria-hidden="true" className="h-4 w-4" />
                {m.phase === 'starting' ? 'Starting…' : 'Start monitoring'}
              </button>
              <p className="basis-full text-[15px] text-muted">
                {inCall ? <>This call is <b className="text-white">{direction}</b>{direction === 'outbound' && ' (writes the bank call log)'}.</>
                  : 'Connect a call first, then start monitoring.'}
              </p>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stamp/20 text-[#a5b4fc]"><UserRound aria-hidden="true" className="h-6 w-6" /></span>
              <div className="min-w-0">
                <p className="label">Claimed customer</p>
                <p className="truncate font-display text-xl font-bold text-white">{startedName ?? (startedCustomerId || '—')}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
                  <span className="font-mono">call {m.callId}</span>
                  <span>{m.direction === 'outbound' ? 'outbound — logged' : m.direction}</span>
                </p>
              </div>
              {live && (
                <span className="inline-flex items-center gap-2 rounded-full border border-stop/60 bg-stop/15 px-3 py-1 text-[15px] font-bold tracking-wider text-stop-fg">
                  <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-stop" />LIVE
                </span>
              )}
            </div>
          )}

          <StateBadge state={m.callState} />
          <IdentityBadge identity={m.identity} />

          {/* Credits: last balance the backend reported (DetectifAI's real number). */}
          <div className="flex flex-col gap-1.5 lg:items-end">
            <span className="label inline-flex items-center gap-1.5"><Coins aria-hidden="true" className="h-4 w-4" />DetectifAI credits</span>
            <span className="font-mono text-3xl font-semibold leading-none text-white">{m.credits ?? '—'}</span>
          </div>
        </div>

        {m.callId && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button onClick={m.togglePause} disabled={!live || m.holding}
              className={`btn-ghost px-4 py-2.5 ${m.paused ? '!border-warn/60 !bg-warn/15 text-warn-fg' : ''}`}>
              {m.paused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
              {m.paused ? 'Resume monitoring' : 'Pause monitoring'}
            </button>
            <button onClick={onEnd} disabled={!live}
              className="inline-flex items-center gap-2 rounded-xl bg-stop px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              <PhoneOff aria-hidden="true" className="h-4 w-4" />
              {m.phase === 'ending' ? 'Ending…' : 'End call'}
            </button>
            <button onClick={() => downloadClip(m.lastClip)} disabled={!m.lastClip} className="btn-ghost px-4 py-2.5">
              <Download aria-hidden="true" className="h-4 w-4" />
              Download last clip{m.lastClip && <span className="font-mono font-normal"> ({m.lastClip.t_start}–{m.lastClip.t_end} s)</span>}
            </button>
            <span className="ml-auto text-[15px] text-muted">
              {live && (m.holding ? 'timeline paused for Say-It-Back'
                : m.paused ? 'paused — not recording (saves credits)'
                : `recording ${CLIP_SECONDS} s clips of the customer`)}
              {m.phase === 'ending' && 'ending — finishing queued uploads…'}
              {m.phase === 'ended' && 'call ended'}
              {' · '}live updates: {wsText(m.wsStatus, live)}
            </span>
          </div>
        )}
      </div>

      {peopleError && !m.callId && (
        <p className="flex items-start gap-2 text-[15px] text-muted">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
          <span className="min-w-0 break-words">Customer list unavailable ({peopleError}) — type the customer id instead.</span>
        </p>
      )}

      {m.callState === 'alert' && (
        <Reveal className="flex gap-4 rounded-2xl border border-stop bg-stop/90 p-5 text-white shadow-[0_0_40px_-10px_rgb(220_38_38/0.9)]">
          <AlertTriangle aria-hidden="true" className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
            <p className="font-display text-xl font-bold">ALERT: Possible handover / voice change</p>
            {m.stateReason && <p className="text-base">Evidence: {m.stateReason}</p>}
            <p className="text-base">
              Next step: every request now needs Say-It-Back. If it fails, do not proceed — use the bank's
              existing OTP to the registered number, or call back on the number on file.
            </p>
          </div>
        </Reveal>
      )}

      {/* Identity = Eidos said this is NOT the claimed customer's voice. Name comes from
          GET /api/people; if the list did not load we show the id instead (never a made-up name). */}
      {m.callId && m.identity === 'no_match' && (
        <Reveal className="flex gap-4 rounded-2xl border border-stop bg-stop/90 p-5 text-white shadow-[0_0_40px_-10px_rgb(220_38_38/0.9)]">
          <AlertTriangle aria-hidden="true" className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
            <p className="font-display text-xl font-bold">
              Caller's voice does not match {startedName ?? startedCustomerId}. Do not proceed with high-risk requests.
            </p>
            <p className="text-base">
              Next step: use the bank's existing OTP to the registered number, or call back on the number on file.
            </p>
          </div>
        </Reveal>
      )}

      {m.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-stop/50 bg-stop/10 p-3 text-base text-stop-fg">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><span className="min-w-0 break-words">{m.error}</span>
        </p>
      )}
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
