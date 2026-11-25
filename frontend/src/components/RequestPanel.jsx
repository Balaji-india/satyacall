// RequestPanel — the customer asks for something → POST /api/calls/{id}/action → the backend
// says allow / say_it_back / fallback. Say-It-Back: pause the timeline, record 10 s of the
// CUSTOMER (remote stream), POST /say-it-back, resume. Every card = evidence + next step.
import { useState } from 'react'
import { errorText, requestAction, sayItBack } from '../api'
import { authenticityText, speakerText } from '../checkText'
import { CLIP_SECONDS, recordClip } from '../clipRecorder'
import { toWav16kMono } from '../toWav'

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
    } catch (err) {
      setError(`Say-It-Back attempt ${attempt} failed: ${err.status ? errorText(err) : err.message}`)
    } finally {
      setRec(null)
    }
  }

  const decision = action?.response?.decision
  const fallback = decision === 'fallback' || result?.next_step === 'fallback' || agentFallback

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Customer request</h2>

      <form onSubmit={submit} className="space-y-2 text-sm">
        <select value={actionType} onChange={(e) => { setActionType(e.target.value); setAction(null); setAgentFallback(false) }}
          className="w-full rounded border bg-white px-2 py-1" disabled={busy}>
          {ACTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {fields.map((f) => (
          <input key={f} value={values[f] ?? ''} placeholder={FIELD_LABEL[f]} aria-label={FIELD_LABEL[f]}
            type={f === 'amount' ? 'number' : f === 'new_email' ? 'email' : 'text'} min={f === 'amount' ? 1 : undefined}
            onChange={(e) => setValues({ ...values, [f]: e.target.value })}
            className="w-full rounded border px-2 py-1" disabled={busy} />
        ))}
        <button disabled={!live || busy || fields.some((f) => !(values[f] ?? '').trim())}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
          {sending ? 'Checking request…' : 'Check request'}
        </button>
        {!live && <p className="text-slate-500">Start monitoring a call first.</p>}
      </form>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {action && (
        <p className="text-sm text-slate-600">
          {action.label}: risk <b>{action.response.risk}</b> · decision <b>{decision}</b>
        </p>
      )}

      {/* allow → green card with the evidence it was based on */}
      {decision === 'allow' && (
        <div className="rounded border-2 border-green-600 bg-green-50 p-3 text-sm">
          <p className="text-lg font-bold text-green-800">✓ Allowed ({action.response.risk} risk)</p>
          <p>Evidence: call state <b>{m.callState ?? 'none yet'}</b>, identity <b>{m.identity ?? 'none yet'}</b>
            {latestClip && <> · latest clip: {latestClip.status === 'skipped' ? 'skipped' : authenticityText(latestClip.authenticity)}</>}</p>
          <p>Next step: go ahead with the request.</p>
        </div>
      )}

      {/* say_it_back → the sentence big + record button(s) */}
      {decision === 'say_it_back' && (
        <div className="space-y-2 rounded border-2 border-slate-800 p-3">
          <p className="text-xs uppercase text-slate-500">Ask the customer to say</p>
          <p className="text-xl font-semibold leading-snug">“{action.response.sentence ?? 'the backend sent no sentence'}”</p>

          {rec && (
            <p className="rounded bg-slate-900 p-2 text-center text-white">
              {rec.phase === 'recording'
                ? `● Recording customer… ${rec.secondsLeft} s (attempt ${rec.attempt})`
                : `Checking attempt ${rec.attempt} (speech-to-text + Eidos + Aletheia)…`}
            </p>
          )}

          {!rec && !result && (
            <button onClick={() => confirm(1)} disabled={!live}
              className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40">
              Record confirmation ({CLIP_SECONDS} s)
            </button>
          )}
          {!rec && result?.next_step === 'retry' && !agentFallback && (
            <div className="flex gap-2">
              <button onClick={() => confirm(2)} disabled={!live}
                className="flex-1 rounded bg-amber-500 px-4 py-2 font-semibold disabled:opacity-40">
                Try again (attempt 2)
              </button>
              <button onClick={() => setAgentFallback(true)}
                title="Skip attempt 2: no new recording, no more credits spent"
                className="flex-1 rounded bg-red-600 px-4 py-2 font-semibold text-white">
                Stop — use fallback
              </button>
            </div>
          )}
        </div>
      )}

      {results.map((r) => <SayItBackCard key={r.key} r={r} />)}

      {/* fallback (from the action decision, or after a failed Say-It-Back) */}
      {fallback && (
        <div className="rounded bg-red-600 p-3 text-white">
          <p className="text-lg font-bold">Do not proceed</p>
          <p className="text-sm">
            Evidence: {agentFallback ? 'Fallback chosen by agent after attempt 1 (Say-It-Back details above)'
              : result ? 'Say-It-Back did not pass (details above)' : `backend decision "fallback" for ${action.label}`}
            {' '}· call state {m.callState ?? 'none yet'} · identity {m.identity ?? 'none yet'}
          </p>
          <p className="text-sm">Next step: {FALLBACK_TEXT}</p>
        </div>
      )}
      {result?.next_step === 'approved' && (
        <div className="rounded bg-green-600 p-3 text-white">
          <p className="text-lg font-bold">✓ Approved</p>
          <p className="text-sm">Next step: complete the customer's request.</p>
        </div>
      )}
    </section>
  )
}

// One Say-It-Back result: the evidence for each of the three checks.
function SayItBackCard({ r }) {
  const tone = r.pass ? 'border-green-600' : r.next_step === 'retry' ? 'border-amber-500' : 'border-red-600'
  return (
    <div className={`space-y-1 rounded border-l-4 ${tone} bg-slate-50 p-2 text-sm`}>
      <p className="font-semibold">Say-It-Back: {r.pass ? 'passed' : 'not passed'} · next step {r.next_step}</p>
      <p><b>Heard:</b> “{r.transcript ?? '—'}”</p>
      <p><b>Expected:</b> “{r.expected ?? '—'}”</p>
      <p><b>Text match:</b> {r.text_match ?? '—'}</p>
      <p><b>Aletheia:</b> {authenticityText(r.authenticity)}</p>
      <p><b>Eidos:</b> {speakerText(r.speaker)}</p>
    </div>
  )
}
