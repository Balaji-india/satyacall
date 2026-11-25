// RequestPanel — the customer asks for something → POST /api/calls/{id}/action → the backend
// says allow / say_it_back / fallback. Say-It-Back: pause the timeline, record 10 s of the
// CUSTOMER (remote stream), POST /say-it-back, resume. Every card = evidence + next step.
import { useState } from 'react'
import { errorText, requestAction, sayItBack } from '../api'
import { authenticityText } from '../checkText'
import { CLIP_SECONDS, recordClip } from '../clipRecorder'
import { toWav16kMono } from '../toWav'
import { toast } from 'sonner'
import { AlertTriangle, AudioLines, Ban, CheckCircle2, ClipboardList, Fingerprint, Loader2, MessageSquareQuote, MessageSquareText, Mic, RotateCw, ShieldQuestion, XCircle } from 'lucide-react'
import { sayItBackSignals, sayItBackWhy } from '../explain'
import { DrawCheck } from './Icons'
import { HowItDecided, Pill, Reveal } from './Tone'
import { TONE } from '../tone'

const ACTIONS = [
  ['balance', 'Balance enquiry'], ['card_status', 'Card status'], ['statement', 'Statement'],
  ['complaint_status', 'Complaint status'], ['branch_info', 'Branch info'],
  ['add_payee', 'Add payee'], ['change_mobile', 'Change mobile number'], ['change_email', 'Change email'],
  ['change_address', 'Change address'], ['reset_credentials', 'Reset password / PIN / MPIN'],
  ['raise_limit', 'Raise limit'], ['large_transfer', 'Large transfer'],
  ['card_new_address', 'Send card to new address'], ['unblock', 'Unblock card / UPI'],
]

// Which extra fields each action needs (sent as `params`).
const FIELDS = {
  add_payee: ['payee_name', 'amount'], large_transfer: ['payee_name', 'amount'], raise_limit: ['amount'],
  change_mobile: ['new_mobile'], change_email: ['new_email'],
  change_address: ['new_address'], card_new_address: ['new_address'],
}
const FIELD_LABEL = { payee_name: 'Payee name', amount: 'Amount (₹)', new_mobile: 'New mobile', new_email: 'New email', new_address: 'New address' }

const FIELD = 'w-full rounded-lg border border-line bg-field px-3 py-2.5 text-base'

const FALLBACK_TEXT = "Do not proceed. Use the bank's existing OTP to the registered number, or call back on the number on file."

export default function RequestPanel({ m, remoteStream }) {
  const [actionType, setActionType] = useState('balance')
  const [values, setValues] = useState({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null)   // { label, response } of the current request
  const [sibStart, setSibStart] = useState(0)  // m.sayItBacks index where this request's results start
  const [rec, setRec] = useState(null)         // null | { attempt, secondsLeft, phase: recording|checking }
  // Agent pressed "Stop — use fallback" after attempt 1 (their decision; no 2nd recording,
  // so no more DetectifAI credits are spent on this request). Nothing is sent to the backend.
  const [agentFallback, setAgentFallback] = useState(false)

  const live = m.phase === 'live'
  const busy = sending || rec !== null
  const fields = FIELDS[actionType] ?? []

  // Say-It-Back results for THIS request (HTTP + WebSocket already merged in useMonitoring).
  const results = action ? m.sayItBacks.slice(sibStart) : []
  const result = results.at(-1)
  const latestClip = [...m.rows].reverse().find((r) => r.result)?.result

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setAction(null); setAgentFallback(false); setSending(true)
    const params = {}
    for (const f of fields) {
      const v = (values[f] ?? '').trim()
      if (v) params[f] = f === 'amount' ? Number(v) : v
    }
    try {
      const response = await requestAction(m.callId, { action_type: actionType, params })
      setAction({ label: ACTIONS.find(([k]) => k === actionType)[1], response })
      setSibStart(m.sayItBacks.length)
    } catch (err) {
      setError(`Request failed: ${errorText(err)}`)
      toast.error('Request check failed', { description: errorText(err) })
    } finally {
      setSending(false)
    }
  }

  // Record the customer's confirmation and send it. One request in flight per call:
  // withTimelinePaused stops clip uploads until this finishes.
  const confirm = async (attempt) => {
    setError('')
    if (!remoteStream) return setError('No customer audio — is the call still connected?')
    setRec({ attempt, secondsLeft: CLIP_SECONDS, phase: 'recording' })
    try {
      const res = await m.withTimelinePaused(async () => {
        const blob = await recordClip(remoteStream, CLIP_SECONDS,
          (secondsLeft) => setRec((r) => r && { ...r, secondsLeft }))
        setRec((r) => r && { ...r, phase: 'checking' })
        // Say-It-Back only: send 16 kHz mono 16-bit WAV (timeline clips stay webm).
        const wav = await toWav16kMono(blob)
        return sayItBack(m.callId, wav, attempt)
      })
      m.addSayItBack(res)
      // Toast text = the backend's own answer.
      ;(res?.pass ? toast.success : res?.next_step === 'retry' ? toast.warning : toast.error)(
        `Say-It-Back attempt ${attempt} sent: ${res?.pass ? 'passed' : 'not passed'}`, { description: `next step: ${res?.next_step}` })
    } catch (err) {
      setError(`Say-It-Back attempt ${attempt} failed: ${err.status ? errorText(err) : err.message}`)
      toast.error(`Say-It-Back attempt ${attempt} failed`, { description: err.status ? errorText(err) : err.message })
    } finally {
      setRec(null)
    }
  }

  const decision = action?.response?.decision
  const fallback = decision === 'fallback' || result?.next_step === 'fallback' || agentFallback
  const riskTone = action?.response?.risk === 'high' ? 'warn' : 'pass'

  return (
    <section className="card min-w-0 space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-white">
        <ClipboardList aria-hidden="true" className="h-5 w-5 text-tide" />Customer request
      </h2>

      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="action-type" className="label block">What does the customer want?</label>
        <select id="action-type" value={actionType} onChange={(e) => { setActionType(e.target.value); setAction(null); setAgentFallback(false) }}
          className={FIELD} disabled={busy}>
          {ACTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {fields.map((f) => (
          <input key={f} value={values[f] ?? ''} placeholder={FIELD_LABEL[f]} aria-label={FIELD_LABEL[f]}
            type={f === 'amount' ? 'number' : f === 'new_email' ? 'email' : 'text'} min={f === 'amount' ? 1 : undefined}
            onChange={(e) => setValues({ ...values, [f]: e.target.value })}
            className={`${FIELD} ${f === 'amount' ? 'font-mono' : ''}`} disabled={busy} />
        ))}
        <button disabled={!live || busy || fields.some((f) => !(values[f] ?? '').trim())}
          className="btn-primary w-full px-4 py-3 text-base">
          <ShieldQuestion aria-hidden="true" className="h-5 w-5" />
          {sending ? 'Checking request…' : 'Check request'}
        </button>
        {!live && <p className="text-[15px] text-muted">Start monitoring a call first — then requests are checked against the live call.</p>}
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-stop/50 bg-stop/10 p-3 text-base text-stop-fg">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      {action && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-base">
          <span className="font-semibold text-white">{action.label}</span>
          <Pill tone={riskTone} swapKey={`${action.label}-${action.response.risk}`}>{action.response.risk} risk</Pill>
          <span className="text-muted">decision <span className="font-mono text-white">{decision}</span></span>
        </div>
      )}

      {/* allow → green card with the evidence it was based on */}
      {decision === 'allow' && (
        <Reveal className="space-y-2 rounded-2xl border border-pass/50 bg-pass/10 p-4">
          <p className="flex items-center gap-2 font-display text-xl font-bold text-pass-fg">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />Allowed
          </p>
          <p className="text-base">
            Evidence: call state <b>{m.callState ?? 'none yet'}</b>, identity <b>{m.identity ?? 'none yet'}</b>
            {latestClip && <> · latest clip: <span className="font-mono text-[15px]">{latestClip.status === 'skipped' ? 'skipped' : authenticityText(latestClip.authenticity)}</span></>}
          </p>
          <HowItDecided>
            The backend rated “{action.label}” {action.response.risk} risk and allowed it while the call state
            was {m.callState ?? 'not set yet'}.
          </HowItDecided>
          <p className="text-base font-semibold">Next step: go ahead with the request.</p>
        </Reveal>
      )}

      {/* say_it_back → the sentence big + record button(s) */}
      {decision === 'say_it_back' && (
        <Reveal className="quote-card space-y-3 p-5">
          <p className="label flex items-center gap-2"><MessageSquareQuote aria-hidden="true" className="h-4 w-4 text-tide" />Ask the customer to say</p>
          <p className="font-display text-2xl font-semibold leading-snug text-white">“{action.response.sentence ?? 'the backend sent no sentence'}”</p>

          {rec && (
            <p className={`flex items-center justify-center gap-2 rounded-xl p-3 text-center text-lg font-semibold text-white ${rec.phase === 'recording' ? 'rec-ring border-2 border-stop bg-stop/25' : 'bg-white/10'}`}>
              {rec.phase === 'recording'
                ? <><Mic aria-hidden="true" className="h-5 w-5" />Recording customer… <span className="font-mono">{rec.secondsLeft} s</span> (attempt {rec.attempt})</>
                : <><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />Checking attempt {rec.attempt} (speech-to-text + Eidos + Aletheia)…</>}
            </p>
          )}

          {!rec && !result && (
            <button onClick={() => confirm(1)} disabled={!live} className="btn-primary w-full px-4 py-3 text-lg">
              <Mic aria-hidden="true" className="h-5 w-5" />Record confirmation ({CLIP_SECONDS} s)
            </button>
          )}
          {!rec && result?.next_step === 'retry' && !agentFallback && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => confirm(2)} disabled={!live}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-warn px-4 py-2.5 font-semibold text-navy disabled:opacity-40">
                <RotateCw aria-hidden="true" className="h-4 w-4" />Try again (attempt 2)
              </button>
              <button onClick={() => setAgentFallback(true)}
                title="Skip attempt 2: no new recording, no more credits spent"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-stop px-4 py-2.5 font-semibold text-white">
                <Ban aria-hidden="true" className="h-4 w-4" />Stop — use fallback
              </button>
            </div>
          )}
        </Reveal>
      )}

      {results.map((r, i) => <SayItBackCard key={r.key} r={r} n={i + 1} />)}

      {/* fallback (from the action decision, or after a failed Say-It-Back) */}
      {fallback && (
        <Reveal className="space-y-3 rounded-2xl bg-stop p-4 text-white shadow-[0_0_36px_-10px_rgb(220_38_38/0.9)]">
          <p className="flex items-center gap-2 font-display text-2xl font-bold"><XCircle aria-hidden="true" className="h-8 w-8 shrink-0" />Do not proceed</p>
          <p className="text-base">
            <span className="font-semibold">How it decided: </span>
            {agentFallback ? 'Fallback chosen by agent after attempt 1 (Say-It-Back details above)'
              : result ? 'Say-It-Back did not pass (details above)' : `backend decision "fallback" for ${action.label}`}
            {' '}· call state {m.callState ?? 'none yet'} · identity {m.identity ?? 'none yet'}
          </p>
          <p className="rounded-xl bg-black/25 p-3 text-lg font-semibold">Next step: {FALLBACK_TEXT}</p>
        </Reveal>
      )}
      {result?.next_step === 'approved' && (
        <Reveal className="flex items-center gap-4 rounded-2xl bg-pass p-4 text-white shadow-[0_0_36px_-10px_rgb(22_163_74/0.9)]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20"><DrawCheck /></span>
          <div>
            <p className="font-display text-2xl font-bold">Approved</p>
            <p className="text-base">Next step: complete the customer's request.</p>
          </div>
        </Reveal>
      )}
    </section>
  )
}

const SIGNAL_ICON = { words: MessageSquareText, person: Fingerprint, human: AudioLines }

// One Say-It-Back result as "3 signals": Words · Same person (Eidos) · Real human (Aletheia),
// each with icon, ✓/✗ word and the score vs threshold from the response.
function SayItBackCard({ r, n }) {
  const tone = r.pass ? 'pass' : r.next_step === 'retry' ? 'warn' : 'stop'
  return (
    <Reveal className={`space-y-3 rounded-2xl border bg-inset p-4 ${TONE[tone].border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">Say-It-Back result {n}</p>
        <Pill tone={tone} swapKey={r.key}>{r.pass ? 'Passed' : 'Not passed'} · next: {r.next_step}</Pill>
      </div>

      <dl className="space-y-1 text-base">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Expected</dt><dd className="min-w-0">“{r.expected ?? '—'}”</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Heard</dt><dd className="min-w-0">“{r.transcript ?? '—'}”</dd></div>
      </dl>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {sayItBackSignals(r).map((s) => {
          const Icon = SIGNAL_ICON[s.key]
          const t = TONE[s.tone]
          return (
            <li key={s.key} className="flex items-start gap-3 p-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.soft} ${t.text}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="font-semibold text-white">{s.name} <span className="text-[15px] font-normal text-muted">· {s.hint}</span></p>
                  <p className={`font-semibold ${t.text}`}>{t.mark} {s.word}</p>
                </div>
                {s.metric && <p className="break-words font-mono text-[15px] text-muted">{s.metric}</p>}
              </div>
            </li>
          )
        })}
      </ul>

      <HowItDecided>{sayItBackWhy(r)}</HowItDecided>
    </Reveal>
  )
}
