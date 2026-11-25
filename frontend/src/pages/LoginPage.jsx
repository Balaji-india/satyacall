// /customer/login and /agent/login — DEMO sign-in (B10).
// Pick yourself from GET /api/people (only real enrolled people of this role) + the demo password.
// The password is checked by comparing its SHA-256 with DEMO_PASSWORD_SHA256 (session.js).
// Success → session in sessionStorage → back to the page that sent us here, else /customer or /agent.
// "Create account" → /enroll?signup=<role>: enrolling the voice IS the sign-up.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorText, listPeople } from '../api'
import { ArrowLeft, CloudOff, Headset, LogIn, RotateCw } from 'lucide-react'
import { LogoMark } from '../components/Icons'
import PhoneFrame from '../components/PhoneFrame'
import ReduceEffectsToggle from '../components/ReduceEffectsToggle'
import VoiceOrb from '../components/VoiceOrb'
import { useMediaQuery } from '../useMediaQuery'
import { checkDemoPassword, HOME_PATH, saveSession } from '../session'

const FIELD = 'field text-lg'

export default function LoginPage({ role }) {
  const isAgent = role === 'agent'
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [people, setPeople] = useState(null) // null = loading
  const [peopleError, setPeopleError] = useState('')
  const [unreachable, setUnreachable] = useState(false) // no HTTP answer at all (server down / offline)
  const [chosen, setChosen] = useState('')   // person_id
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  // Agents need an employee ID (the call log and the customer's "Verify caller" use it).
  const [reload, setReload] = useState(0) // bumped by "Retry"
  useEffect(() => {
    listPeople()
      .then((list) => setPeople((Array.isArray(list) ? list : [])
        .filter((p) => p.role === role && (!isAgent || p.employee_id))))
      .catch((err) => { setPeople([]); setPeopleError(errorText(err)); setUnreachable(!err?.status) })
  }, [role, isAgent, reload])
  const retry = () => { setPeople(null); setPeopleError(''); setUnreachable(false); setReload((n) => n + 1) }
  // The 3D orb only on wide screens (where it is visible) — narrow screens never load three.js.
  const wide = useMediaQuery('(min-width: 1024px)')

  const submit = async (e) => {
    e.preventDefault()
    const person = people?.find((p) => p.person_id === chosen)
    if (!person) return
    setChecking(true); setError('')
    try {
      if (!(await checkDemoPassword(password))) { setError('Incorrect password'); return }
      const session = { role, person_id: person.person_id, display_name: person.display_name }
      if (isAgent) session.employee_id = String(person.employee_id)
      if (!saveSession(session)) { setError('This browser blocks session storage — allow it, then sign in again.'); return }
      // Only return to a page of this role (e.g. /customer?tab=verify); otherwise the role's home.
      navigate(typeof from === 'string' && from.startsWith(HOME_PATH[role]) ? from : HOME_PATH[role], { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="who" className="label block">{isAgent ? 'Employee ID' : 'Your name'}</label>
        {people === null && <p className="text-base text-muted">Loading {isAgent ? 'staff' : 'customers'}…</p>}
        {people?.length > 0 && (
          <select id="who" value={chosen} onChange={(e) => { setChosen(e.target.value); setError('') }}
            disabled={checking} className={FIELD}>
            <option value="">choose…</option>
            {people.map((p) => (
              <option key={p.person_id} value={p.person_id}>
                {isAgent ? `${p.employee_id} — ${p.display_name}${p.department ? `, ${p.department}` : ''}` : p.display_name}
              </option>
            ))}
          </select>
        )}
        {people?.length === 0 && (peopleError ? (
          // Backend unreachable (or erroring): say so plainly, show its message, offer Retry.
          <div role="status" className="space-y-3 rounded-2xl border border-warn/40 bg-warn/10 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn-fg">
                <CloudOff aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-warn-fg">
                  {unreachable ? "Can't reach the bank server" : `The bank server couldn't list ${isAgent ? 'staff' : 'customers'}`}
                </p>
                <p className="text-base text-muted">
                  {unreachable ? 'Check the backend is running and on the same network, then retry.' : 'Retry, or check the backend log.'}
                </p>
              </div>
            </div>
            <p className="break-words rounded-lg bg-inset px-3 py-2 font-mono text-sm text-muted">{peopleError}</p>
            <button type="button" onClick={retry} className="btn-ghost w-full px-3 py-2.5 text-base">
              <RotateCw aria-hidden="true" className="h-4 w-4" />Retry
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-inset p-3 text-base">
            Nobody is enrolled as {isAgent ? 'staff with an employee ID' : 'a customer'} yet — create an account below.
          </p>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pw" className="label block">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} disabled={checking}
          onChange={(e) => { setPassword(e.target.value); setError('') }} className={FIELD} />
      </div>

      {error && <p role="alert" className="rounded-xl border border-stop/40 bg-stop/10 p-3 text-base font-semibold text-stop-fg">{error}</p>}

      <div className="space-y-2">
        <button disabled={!chosen || !password || checking} className="btn-primary min-h-14 w-full py-3.5 text-lg">
          <LogIn aria-hidden="true" className="h-5 w-5" />
          {checking ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-base text-muted">Demo sign-in — a real bank uses its existing login.</p>
      </div>

      <p className="text-center text-base text-muted">
        New here? <Link to={`/enroll?signup=${role}`} className="link">Create account</Link>
      </p>
    </form>
  )

  // Left side on wide screens: the voice orb and one line on what this device does.
  const aside = wide && (
    <div className="hidden w-full max-w-[520px] flex-col items-center gap-6 text-center lg:flex">
      <VoiceOrb shadow={!isAgent} dark={isAgent} className="w-full max-w-[440px]" />
      <div className="space-y-2">
        <p className="font-display text-3xl font-semibold leading-tight text-fg">
          {isAgent ? 'Know the voice on the line is real, and really theirs.' : 'Know it is really your bank before you share a thing.'}
        </p>
        <p className="text-lg text-muted">
          {isAgent ? 'Live AI-voice checks and Say-It-Back for risky requests.' : 'Verify any caller who says they are from SatyaBank.'}
        </p>
      </div>
    </div>
  )

  if (!isAgent) {
    return (
      <PhoneFrame aside={aside}>
        <div className="space-y-6 px-5 pb-8 pt-8">
          <div className="space-y-1">
            <h1 className="text-[28px] font-bold leading-tight">Welcome back</h1>
            <p className="text-base text-muted">Sign in to SatyaBank.</p>
          </div>
          <div className="card p-5">{form}</div>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <div className="theme-dark desk-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="font-display text-xl font-extrabold tracking-tight">SatyaBank</span>
          <span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-base font-semibold text-accent">Agent desk</span>
          <div className="ml-auto"><ReduceEffectsToggle /></div>
        </header>
        <main className="flex flex-1 items-center justify-center gap-16 py-10 lg:justify-between">
          {aside}
          <div className="w-full max-w-md space-y-5">
            <section className="glass space-y-6 p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ocean/20 text-accent ring-1 ring-gold/40"><Headset aria-hidden="true" className="h-6 w-6" /></span>
                <div>
                  <h1 className="text-2xl font-bold">Staff sign-in</h1>
                  <p className="text-base text-muted">SatyaBank agent desk</p>
                </div>
              </div>
              <hr className="rule-gold" />
              {form}
            </section>
            <Link to="/" className="flex items-center justify-center gap-2 text-base text-muted underline-offset-2 hover:text-fg hover:underline">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to device chooser
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
