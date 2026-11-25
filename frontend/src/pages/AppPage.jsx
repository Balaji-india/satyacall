// /app — the customer's bank app (B6): "Verify This Caller".
// Someone calls claiming to be from the bank. The customer types the caller's employee ID, puts
// the call on speakerphone, records 10 s from THIS phone's mic → POST /api/verify-caller.
// The backend decides (call log + Eidos + Aletheia); we only show its answer and evidence.
import { useEffect, useState } from 'react'
import { errorText, listPeople, verifyCaller } from '../api'
import { authenticityText, speakerText } from '../checkText'
import { useMicRecorder } from '../useMicRecorder'

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
  const [customerId, setCustomerId] = useState('')
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
      setResult(await verifyCaller(blob, employeeId, customerId.trim()))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setChecking(false)
    }
  }
  const mic = useMicRecorder(RECORD_SECONDS, send, MIC)

  const start = () => { setResult(null); setError(''); mic.start() }
  // Changing who / which ID makes an old answer wrong → clear it.
  const change = (setter) => (value) => { setter(value); setResult(null); setError('') }

  const busy = mic.recording || checking
  const canRecord = customerId.trim() && employeeId && !busy

  return (
    <section className="mx-auto max-w-[420px] space-y-5 rounded-2xl border bg-white p-5">
      <h1 className="text-2xl font-bold">Verify This Caller</h1>

      <CustomerPicker customers={customers} peopleError={peopleError} value={customerId}
        onChange={change(setCustomerId)} disabled={busy} />

      <div className="space-y-1">
        <label htmlFor="emp" className="block text-sm font-medium">Caller's employee ID</label>
        <input id="emp" inputMode="numeric" autoComplete="off" value={employeeId} disabled={busy}
          onChange={(e) => change(setEmployeeId)(e.target.value.replace(/\D/g, ''))}
          placeholder="Ask the caller, e.g. 4521"
          className="w-full rounded-lg border px-3 py-3 text-lg tracking-widest" />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-600">Put the call on speakerphone, then let the caller talk for {RECORD_SECONDS} s.</p>
        <button onClick={start} disabled={!canRecord}
          className="w-full rounded-xl bg-slate-900 py-4 text-lg font-semibold text-white disabled:opacity-40">
          {mic.recording ? `Recording… ${Math.max(RECORD_SECONDS - mic.elapsed, 0)} s`
            : checking ? 'Checking with your bank…'
            : `Record caller (${RECORD_SECONDS} s)`}
        </button>
        {mic.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{mic.error}</p>}
      </div>

      {error && (
        <div className="space-y-2 rounded-xl bg-red-50 p-3 text-red-800">
          <p className="font-semibold">Could not check this caller</p>
          <p className="text-sm">{error}</p>
          <p className="text-sm">Until it is checked, treat the caller as unconfirmed.</p>
          <OfficialNumber />
        </div>
      )}

      {result && <Result result={result} />}
    </section>
  )
}

// "Logged in as": dropdown of enrolled customers, or a text box if the list isn't available.
function CustomerPicker({ customers, peopleError, value, onChange, disabled }) {
  if (customers === null) return <p className="text-sm text-slate-500">Loading customers…</p>
  return (
    <div className="space-y-1">
      <label htmlFor="who" className="block text-sm font-medium">Logged in as</label>
      {customers.length > 0 ? (
        <select id="who" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full rounded-lg border bg-white px-3 py-3 text-lg">
          <option value="">choose…</option>
          {customers.map((p) => (
            <option key={p.person_id} value={p[CUSTOMER_ID_FIELD]}>{p.display_name} ({p[CUSTOMER_ID_FIELD]})</option>
          ))}
        </select>
      ) : (
        <>
          <input id="who" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
            placeholder="your customer id" className="w-full rounded-lg border px-3 py-3 text-lg" />
          <p className="text-xs text-slate-500">
            {peopleError ? `Customer list unavailable (${peopleError}) — type your id.` : 'No enrolled customers — type your id.'}
          </p>
        </>
      )}
    </div>
  )
}

// The backend's answer: big verdict, then each check with its evidence, then next_step.
function Result({ result }) {
  const { verified, checks = {}, employee, next_step } = result
  return (
    <div className="space-y-4">
      {verified ? (
        <div className="rounded-xl bg-green-600 p-4 text-white">
          <p className="text-2xl font-bold">
            Verified: {employee?.name ?? 'unknown name'}, {employee?.department ?? 'unknown department'}
          </p>
          <p className="mt-1">You can continue the call.</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-red-600 p-4 text-white">
          <p className="text-2xl font-bold">We can't confirm this caller</p>
          <p>Hang up and call your bank's official number.</p>
          <OfficialNumber />
        </div>
      )}

      <ul className="divide-y rounded-xl border">
        <CallLogCheck c={checks.call_log} />
        <SpeakerCheck s={checks.speaker} />
        <AuthenticityCheck a={checks.authenticity} />
      </ul>

      {next_step && (
        <p className="rounded-xl bg-slate-100 p-3"><span className="font-semibold">Next step: </span>{next_step}</p>
      )}
    </div>
  )
}

// Big "call the bank" button — only with a configured number; otherwise point to the card.
function OfficialNumber() {
  if (!OFFICIAL_NUMBER) {
    return <p className="rounded-xl bg-white p-4 text-center text-lg font-semibold text-red-700">Use the number on the back of your card</p>
  }
  return (
    <a href={`tel:${OFFICIAL_NUMBER.replace(/[^\d+]/g, '')}`}
      className="block rounded-xl bg-white p-4 text-center text-lg font-semibold text-red-700">
      Call your bank: {OFFICIAL_NUMBER}
    </a>
  )
}

// One row of the checks list. mark: true = ✓, false = ✗, null = not run / unavailable (–).
function CheckRow({ name, mark, text }) {
  const icon = mark === true ? '✓' : mark === false ? '✗' : '–'
  const color = mark === true ? 'text-green-700' : mark === false ? 'text-red-700' : 'text-slate-500'
  return (
    <li className="flex gap-3 p-3">
      <span className={`text-xl font-bold ${color}`}>{icon}</span>
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-slate-600">{text}</p>
      </div>
    </li>
  )
}

// call_log = { pass, detail } — does the bank have an outbound call from this employee to me?
function CallLogCheck({ c }) {
  if (!c) return <CheckRow name="Bank call log" mark={null} text="no result from the backend" />
  return <CheckRow name="Bank call log" mark={c.pass === true ? true : c.pass === false ? false : null}
    text={c.detail ?? (c.pass ? 'call found' : 'no call found')} />
}

// speaker (Eidos) — is this the voice enrolled for that employee?
function SpeakerCheck({ s }) {
  const mark = s?.decision === 'match' ? true : s?.decision === 'no_match' ? false : null
  return <CheckRow name="Voice match" mark={mark}
    text={s ? speakerText(s, 'Voice check skipped — no call record, so no credits spent') : 'no result from the backend'} />
}

// authenticity (Aletheia) — real human voice or AI-generated?
function AuthenticityCheck({ a }) {
  const mark = a?.verdict === 'real' ? true : a?.verdict === 'fake' ? false : null
  const text = !a || a.verdict === 'not_checked' ? 'skipped — not run' : authenticityText(a)
  return <CheckRow name="Real voice" mark={mark} text={text} />
}
