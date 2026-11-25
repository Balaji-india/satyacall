// /enroll — enroll a customer or agent voice with DetectifAI Eidos (B5).
// Record 25 s from the mic (or choose a file) → preview → POST /api/people/enroll → show the
// backend's { speaker_id, samples, speech_seconds }. Every number shown comes from the backend.
// Sign-up mode (B10, /enroll?signup=customer|agent): role is fixed, enrolling the voice IS the
// sign-up; fields can be pre-filled from the URL (?name=&phone=&employee_id=&department=).
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { enrollPerson, errorCode, errorText, listPeople } from '../api'
import PeopleList from '../components/PeopleList'
import { LOGIN_PATH } from '../session'
import { useMicRecorder } from '../useMicRecorder'

const RECORD_SECONDS = 25            // inside DetectifAI's 15–60 s enrollment window
const MIN_SECONDS = 15
const MAX_SECONDS = 60

// "Balaji Keerthi" → "balaji-keerthi"
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// What the agent should do about an enrollment error (shown under the backend's own message).
function errorHint(err) {
  const code = errorCode(err) ?? ''
  if (!err.status) return 'Backend unreachable — check it is running, then retry.'
  if (err.status === 408 || code === 'upload_timeout' || code === 'network_error') return 'Connection too slow, retry.'
  if (code.includes('speech') || (err.status === 422 && code)) return 'Record again, speak for the whole time.'
  if (err.status === 409 || code === 'too_many_samples') return 'This voice already has the maximum 5 samples.'
  if (err.status === 402 || code === 'credit_floor') return 'Not enough DetectifAI credits — nothing was enrolled.'
  if (err.status === 415) return 'Unsupported audio format — use wav, m4a, mp3 or webm.'
  if (err.status === 413) return 'File too large.'
  return ''
}

// signup = 'customer' | 'agent' on the sign-up page; undefined on the admin page.
export default function EnrollPage({ signup }) {
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => {
    const name = params.get('name') ?? ''
    return {
      display_name: name, person_id: slugify(name), role: signup ?? 'customer',
      phone: params.get('phone') ?? '', employee_id: params.get('employee_id') ?? '', department: params.get('department') ?? '',
    }
  })
  const [idEdited, setIdEdited] = useState(false) // person_id follows the name until edited by hand
  const [audio, setAudio] = useState(null)        // { blob, url, seconds|null, filename, source }
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)      // backend response
  const [error, setError] = useState(null)        // { text, hint }
  const [people, setPeople] = useState(null)      // null = loading
  const [peopleError, setPeopleError] = useState('')
  const urlRef = useRef(null)

  // New audio replaces the old one; free the old preview URL.
  const replaceAudio = (blob, seconds, filename, source) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = blob ? URL.createObjectURL(blob) : null
    setAudio(blob ? { blob, url: urlRef.current, seconds, filename, source } : null)
    setResult(null); setError(null)
  }
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const mic = useMicRecorder(RECORD_SECONDS, (blob, seconds) => replaceAudio(blob, seconds, 'enroll.webm', 'recorded'))

  // GET /api/people (state is only set when the answer arrives).
  const fetchPeople = () =>
    listPeople()
      .then((list) => { setPeople(Array.isArray(list) ? list : []); setPeopleError('') })
      .catch((err) => setPeopleError(errorText(err)))
  useEffect(() => { fetchPeople() }, [])
  // Refresh button / after enrolling: show "Loading…" again, then fetch.
  const loadPeople = () => { setPeople(null); setPeopleError(''); fetchPeople() }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setName = (e) => {
    const name = e.target.value
    setForm((f) => ({ ...f, display_name: name, person_id: idEdited ? f.person_id : slugify(name) }))
  }

  // "Choose audio file": read its length from the file itself (null if the browser can't tell).
  const chooseFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // choosing the same file again still fires onChange
    if (!file) return
    replaceAudio(file, null, file.name, 'file')
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setAudio((a) => (a?.blob === file ? { ...a, seconds: Math.round(probe.duration * 10) / 10 } : a))
    }
    probe.src = urlRef.current
  }

  const isAgent = form.role === 'agent'
  const missing = !form.display_name.trim() || !form.person_id.trim() ||
    (isAgent ? !form.employee_id.trim() || !form.department.trim() : !form.phone.trim())
  const lengthWarning = audio?.seconds != null && (audio.seconds < MIN_SECONDS || audio.seconds > MAX_SECONDS)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true); setResult(null); setError(null)
    const fields = { person_id: form.person_id.trim(), display_name: form.display_name.trim(), role: form.role }
    if (isAgent) Object.assign(fields, { employee_id: form.employee_id.trim(), department: form.department.trim() })
    else fields.phone = form.phone.trim()
    try {
      setResult(await enrollPerson(fields, audio.blob, audio.filename))
      loadPeople()
    } catch (err) {
      setError({ text: errorText(err), hint: errorHint(err) })
    } finally {
      setSubmitting(false)
    }
  }

  const busy = mic.starting || mic.recording || submitting
  const input = 'w-full rounded border px-2 py-1'

  return (
    <section className="glass space-y-6 p-6">
      {signup ? (
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{signup === 'agent' ? 'Create a staff account' : 'Create your SatyaBank account'}</h1>
          <p className="text-slate-600">Your voice sample becomes your account's voice ID (~200 credits).</p>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold">Enroll a voice</h1>
      )}

      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {/* Who */}
        <fieldset className="space-y-2 text-sm" disabled={busy}>
          <label className="block">Display name
            <input value={form.display_name} onChange={setName} placeholder="Balaji Keerthi" className={input} />
          </label>
          <label className="block">person_id <span className="text-slate-500">(from the name, editable)</span>
            <input value={form.person_id} placeholder="balaji" className={`${input} font-mono`}
              onChange={(e) => { setIdEdited(true); set('person_id')(e) }} />
          </label>
          <div className="flex gap-4" hidden={!!signup}>
            {['customer', 'agent'].map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} /> {r}
              </label>
            ))}
          </div>
          {isAgent ? (
            <>
              <label className="block">Employee id
                <input value={form.employee_id} onChange={set('employee_id')} placeholder="4521" className={input} />
              </label>
              <label className="block">Department
                <input value={form.department} onChange={set('department')} placeholder="Card Services" className={input} />
              </label>
            </>
          ) : (
            <label className="block">Phone (registered number)
              <input value={form.phone} onChange={set('phone')} type="tel" placeholder="+91…" className={input} />
            </label>
          )}
        </fieldset>

        {/* Voice sample */}
        <div className="space-y-2 text-sm">
          <p className="text-slate-600">
            Voice sample: {MIN_SECONDS}–{MAX_SECONDS} s with at least 10 s of speech. Read anything aloud, naturally, for the whole time.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!mic.recording ? (
              <button type="button" onClick={mic.start} disabled={submitting || mic.starting}
                className="btn-primary px-4 py-2 disabled:opacity-40">
                {mic.starting ? 'Opening microphone…' : audio ? 'Record again' : `Record ${RECORD_SECONDS} s`}
              </button>
            ) : (
              <button type="button" onClick={mic.stop} className="rounded bg-red-600 px-4 py-2 text-white">
                Stop early
              </button>
            )}
            <label className={`cursor-pointer rounded border px-4 py-2 ${busy ? 'pointer-events-none opacity-40' : ''}`}>
              Choose audio file
              <input type="file" accept="audio/*,.wav,.m4a,.mp3,.webm" onChange={chooseFile} className="hidden" />
            </label>
          </div>

          {mic.recording && (
            <p className={`rounded p-2 text-center font-semibold text-white ${mic.elapsed < MIN_SECONDS ? 'bg-amber-600' : 'bg-pass'}`}>
              ● Recording… {RECORD_SECONDS - mic.elapsed} s left
              {mic.elapsed < MIN_SECONDS && ` (stopping now gives only ${mic.elapsed} s — under ${MIN_SECONDS} s)`}
            </p>
          )}
          {mic.error && <p className="rounded bg-red-50 p-2 text-red-700">{mic.error}</p>}

          {audio && (
            <div className="space-y-1 rounded border p-2">
              <p>{audio.source === 'recorded' ? 'Recorded' : audio.filename} · {audio.seconds != null ? `${audio.seconds} s` : 'length unknown'}</p>
              <audio controls src={audio.url} className="w-full" />
              {lengthWarning && (
                <p className="text-amber-700">
                  ⚠ {audio.seconds} s is outside {MIN_SECONDS}–{MAX_SECONDS} s — DetectifAI will likely reject it. Record again.
                </p>
              )}
            </div>
          )}

          <button disabled={busy || missing || !audio}
            className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40">
            {submitting ? 'Enrolling…' : 'Enroll voice (uses ~200 credits)'}
          </button>
          {missing && <p className="text-slate-500">Fill in name, person_id and {isAgent ? 'employee id + department' : 'phone'}.</p>}

          {error && (
            <div className="rounded bg-red-50 p-2 text-red-700">
              <p>Enrollment failed — {error.text}</p>
              {error.hint && <p className="font-semibold">{error.hint}</p>}
            </div>
          )}
          {result && (
            <div className="rounded border-2 border-green-600 bg-green-50 p-2">
              <p className="font-semibold text-green-800">✓ Enrolled {result.person_id}</p>
              <p>speaker_id <span className="font-mono">{result.speaker_id}</span> · samples {result.samples ?? '—'} · speech {result.speech_seconds ?? '—'} s</p>
              {signup
                ? <p><Link to={LOGIN_PATH[signup]} className="font-semibold text-tide underline">Account created — sign in now</Link></p>
                : <p className="text-slate-600">Next step: test it on a call. Add a second sample only if credits allow.</p>}
            </div>
          )}
        </div>
      </form>

      <p className="rounded bg-slate-50 p-2 text-sm text-slate-600">
        Each sample costs 200 credits. Add a second sample (recorded over a call or on another device) only if credits allow.
      </p>

      {/* A new customer signing up should not see everyone enrolled. */}
      {!signup && <PeopleList people={people} error={peopleError} onRefresh={loadPeople} />}
    </section>
  )
}
