// Verify caller tab of /customer (was /app) — the customer's bank app (B6): "Verify This Caller".
// Someone calls claiming to be from the bank. The customer types the caller's employee ID, puts
// the call on speakerphone, records 10 s from THIS phone's mic → POST /api/verify-caller.
// The backend decides (call log + Eidos + Aletheia); we only show its answer and evidence.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, BadgeCheck, Mic, Phone, ShieldAlert } from 'lucide-react'
import { errorText, listPeople, verifyCaller } from '../api'
import { getSession } from '../session'
import { useCalmWhile } from '../effects'
import { useMicRecorder } from '../useMicRecorder'
import { verifySteps, verifyWhy } from '../explain'
import { DrawCheck } from '../components/Icons'
import { HowItDecided, Reveal, ToneIcon } from '../components/Tone'
import { TONE } from '../tone'

const RECORD_SECONDS = 10
// Which GET /api/people field is sent as customer_id. person_id = what /agent sends as
// claimed_customer_id, so it matches the call log. Change here if the backend wants another.
const CUSTOMER_ID_FIELD = 'person_id'
// Caller is on speakerphone: turn off the browser's voice "clean-up" so we record the raw sound.
const MIC = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
// From frontend/.env. Empty → we never invent a number (see OfficialNumber).
const OFFICIAL_NUMBER = (import.meta.env.VITE_BANK_OFFICIAL_NUMBER ?? '').trim()

export default function AppPage() {
  const [customers, setCustomers] = useState(null) // null = loading
  const [peopleError, setPeopleError] = useState('')
  // "Logged in as" starts as the signed-in customer (B10 demo sign-in); still editable.
  const [customerId, setCustomerId] = useState(() => getSession()?.person_id ?? '')
  const [employeeId, setEmployeeId] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)       // backend response
  const [error, setError] = useState('')

  // Enrolled customers for "Logged in as". Error or empty list → text input instead.
  useEffect(() => {
    listPeople()
      .then((people) => setCustomers((Array.isArray(people) ? people : []).filter((p) => p.role === 'customer')))
      .catch((err) => { setCustomers([]); setPeopleError(errorText(err)) })
  }, [])

  // Recording finished (timer) → send the complete webm to the backend.
  const send = async (blob) => {
    setChecking(true)
    try {
      const res = await verifyCaller(blob, employeeId, customerId.trim())
      setResult(res)
      // Toast = the backend's own verdict, worded for the customer.
      if (res?.verified) toast.success(`Caller verified${res.employee?.name ? `: ${res.employee.name}` : ''}`)
      else toast.error("We can't confirm this caller")
    } catch (err) {
      setError(errorText(err))
      toast.error('Could not check this caller', { description: errorText(err) })
    } finally {
      setChecking(false)
    }
  }
  const mic = useMicRecorder(RECORD_SECONDS, send, MIC)
  useCalmWhile(mic.recording) // visual only: background animation off while recording

  const start = () => { setResult(null); setError(''); mic.start() }
  // Changing who / which ID makes an old answer wrong → clear it.
  const change = (setter) => (value) => { setter(value); setResult(null); setError('') }

  const busy = mic.starting || mic.recording || checking
  const canRecord = customerId.trim() && employeeId && !busy

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-navy">Verify a caller</h1>
        <p className="text-base text-muted">Someone says they're from SatyaBank? Check before you share anything.</p>
      </div>

      <div className="card space-y-4 p-4">
        <CustomerPicker customers={customers} peopleError={peopleError} value={customerId}
          onChange={change(setCustomerId)} disabled={busy} />

        <div className="space-y-1.5">
          <label htmlFor="emp" className="label block">Caller's employee ID</label>
          <input id="emp" inputMode="numeric" autoComplete="off" value={employeeId} disabled={busy}
            onChange={(e) => change(setEmployeeId)(e.target.value.replace(/\D/g, ''))}
            placeholder="Ask the caller, e.g. 4521"
            className="field font-mono text-xl tracking-[0.2em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="flex items-start gap-2 text-base text-muted">
          <Phone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-tide" />
          Put the call on speakerphone, then let the caller talk for {RECORD_SECONDS} s.
        </p>
        <button onClick={start} disabled={!canRecord}
          className={`btn-primary min-h-16 w-full rounded-2xl py-4 text-lg ${mic.recording ? 'rec-ring !bg-stop' : ''}`}>
          <Mic aria-hidden="true" className="h-6 w-6" />
          {mic.starting ? 'Opening microphone…'
            : mic.recording ? <>Recording… <span className="font-mono">{Math.max(RECORD_SECONDS - mic.elapsed, 0)} s</span></>
            : checking ? 'Checking with your bank…'
            : `Record caller (${RECORD_SECONDS} s)`}
        </button>
        {mic.error && <p role="alert" className="break-words rounded-xl border border-stop/40 bg-stop/10 p-3 text-base text-stop-fg">{mic.error}</p>}
      </div>

      {error && (
        <Reveal className="space-y-3 rounded-2xl border border-warn/50 bg-warn/10 p-4">
          <p className="flex items-center gap-2 text-lg font-bold text-warn-fg">
            <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0" />Could not check this caller
          </p>
          <p className="break-words text-base">{error}</p>
          <p className="text-base">Until it is checked, treat the caller as unconfirmed.</p>
          <OfficialNumber />
        </Reveal>
      )}

      {result && <Result result={result} employeeId={employeeId} />}
    </section>
  )
}

// "Logged in as": dropdown of enrolled customers, or a text box if the list isn't available.
function CustomerPicker({ customers, peopleError, value, onChange, disabled }) {
  if (customers === null) return <p className="text-base text-muted">Loading customers…</p>
  return (
    <div className="space-y-1.5">
      <label htmlFor="who" className="label block">Logged in as</label>
      {customers.length > 0 ? (
        <select id="who" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="field text-lg">
          <option value="">choose…</option>
          {customers.map((p) => (
            <option key={p.person_id} value={p[CUSTOMER_ID_FIELD]}>{p.display_name} ({p[CUSTOMER_ID_FIELD]})</option>
          ))}
        </select>
      ) : (
        <>
          <input id="who" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
            placeholder="your customer id" className="field font-mono text-lg" />
          <p className="flex items-start gap-2 text-[15px] text-muted">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
            <span className="min-w-0 break-words">{peopleError ? `Customer list unavailable (${peopleError}) — type your id.` : 'No enrolled customers — type your id.'}</span>
          </p>
        </>
      )}
    </div>
  )
}

// The backend's answer: big verdict card, the checks in the order they run, how it decided,
// then next_step.
function Result({ result, employeeId }) {
  const { verified, employee, next_step } = result
  return (
    <div className="space-y-4">
      {verified ? (
        <Reveal className="flex gap-4 rounded-2xl bg-pass p-5 text-white shadow-[0_16px_36px_-16px_rgb(22_163_74/0.8)]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20"><DrawCheck className="h-9 w-9" /></span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-semibold text-white/90"><BadgeCheck aria-hidden="true" className="h-5 w-5" />Verified caller</p>
            <p className="break-words font-display text-2xl font-bold leading-tight">
              {employee?.name ?? 'unknown name'}, {employee?.department ?? 'unknown department'}
            </p>
            <p className="mt-1 text-base">You can continue the call.</p>
          </div>
        </Reveal>
      ) : (
        <Reveal className="space-y-3 rounded-2xl bg-stop p-5 text-white shadow-[0_16px_36px_-16px_rgb(220_38_38/0.8)]">
          <div className="flex items-center gap-3">
            <ShieldAlert aria-hidden="true" className="h-11 w-11 shrink-0" />
            <p className="font-display text-2xl font-bold leading-tight">We can't confirm this caller</p>
          </div>
          <p className="text-lg">Hang up and call your bank's official number.</p>
          <OfficialNumber />
        </Reveal>
      )}

      <Reveal delay={0.08} className="card p-4">
        <h2 className="mb-3 text-lg font-bold text-navy">Checks in order</h2>
        <ol>
          {verifySteps(result).map((step, i, all) => <Step key={step.key} n={i + 1} step={step} last={i === all.length - 1} />)}
        </ol>
      </Reveal>

      <Reveal delay={0.14} className="space-y-3">
        <HowItDecided>{verifyWhy(result, employeeId)}</HowItDecided>
        {next_step && (
          <p className="card p-4 text-base"><span className="font-semibold">Next step: </span>{next_step}</p>
        )}
      </Reveal>
    </div>
  )
}

// One step of the stepper: number on a rail, name, verdict (icon + word), evidence in mono.
function Step({ n, step, last }) {
  const t = TONE[step.tone]
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute bottom-1 left-[15px] top-9 w-0.5 bg-line" />}
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[15px] font-semibold text-white ${t.solid}`}>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <p className="font-semibold">{step.name}</p>
          <p className={`inline-flex items-center gap-1 text-base font-semibold ${t.text}`}>
            <ToneIcon tone={step.tone} className="h-4 w-4" />{step.word}
          </p>
        </div>
        <p className="text-[15px] text-muted">{step.hint}</p>
        {step.metric && <p className="mt-1 break-words font-mono text-[15px]">{step.metric}</p>}
      </div>
    </li>
  )
}

// Big "call the bank" button — only with a configured number; otherwise point to the card.
function OfficialNumber() {
  if (!OFFICIAL_NUMBER) {
    return <p className="rounded-2xl bg-white p-4 text-center text-lg font-bold text-stop">Use the number on the back of your card</p>
  }
  return (
    <a href={`tel:${OFFICIAL_NUMBER.replace(/[^\d+]/g, '')}`}
      className="flex items-center justify-center gap-2 rounded-2xl bg-white p-4 text-center text-lg font-bold text-stop">
      <Phone aria-hidden="true" className="h-5 w-5" />Call your bank: <span className="font-mono">{OFFICIAL_NUMBER}</span>
    </a>
  )
}
