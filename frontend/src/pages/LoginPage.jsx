// /customer/login and /agent/login — DEMO sign-in (B10).
// Pick yourself from GET /api/people (only real enrolled people of this role) + the demo password.
// The password is checked by comparing its SHA-256 with DEMO_PASSWORD_SHA256 (session.js).
// Success → session in sessionStorage → back to the page that sent us here, else /customer or /agent.
// "Create account" → /enroll?signup=<role>: enrolling the voice IS the sign-up.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorText, listPeople } from '../api'
import { ArrowLeft, CloudOff, LogIn, MonitorSmartphone, RotateCw } from 'lucide-react'
import CyberBackground from '../components/CyberBackground'
import { LogoMark } from '../components/Icons'
import PhoneFrame from '../components/PhoneFrame'
import { checkDemoPassword, HOME_PATH, saveSession } from '../session'

const FIELD = 'field text-lg'

export default function LoginPage({ role }) {
  const isAgent = role === 'agent'
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [people, setPeople] = useState(null) // null = loading
  const [peopleError, setPeopleError] = useState('')
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
      .catch((err) => { setPeople([]); setPeopleError(errorText(err)) })
  }, [role, isAgent, reload])
  const retry = () => { setPeople(null); setPeopleError(''); setReload((n) => n + 1) }

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
          <div role="status" className="space-y-2 rounded-xl border border-warn/50 bg-warn/10 p-3">
            <p className="flex items-center gap-2 font-semibold text-warn-fg">
              <CloudOff aria-hidden="true" className="h-5 w-5 shrink-0" />
              Can't load the {isAgent ? 'staff' : 'customer'} list
            </p>
            <p className="break-words text-[15px]">{peopleError}</p>
            <button type="button" onClick={retry} className="btn-ghost px-3 py-1.5 text-[15px]">
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
        <p className="text-center text-[15px] text-muted">Demo sign-in — a real bank uses its existing login.</p>
      </div>

      <p className="text-center text-base text-muted">
        New here? <Link to={`/enroll?signup=${role}`} className="font-semibold text-stamp underline underline-offset-2 [.theme-dark_&]:text-tide">Create account</Link>
      </p>
    </form>
  )

  if (!isAgent) {
    return (
      <PhoneFrame>
        <div className="space-y-6 px-5 pb-8 pt-8">
          <div className="space-y-1">
            <h1 className="text-[28px] font-bold leading-tight text-navy">Welcome back</h1>
            <p className="text-base text-muted">Sign in to SatyaBank.</p>
          </div>
          <div className="card p-5">{form}</div>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <div className="theme-dark desk-bg min-h-screen">
      <CyberBackground />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
        <div className="flex items-center justify-center gap-3">
          <LogoMark className="h-11 w-11" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-white">SatyaBank</span>
          <span className="rounded-md border border-tide/50 bg-tide/10 px-2 py-0.5 text-[15px] font-semibold text-tide">Agent desk</span>
        </div>
        <section className="card space-y-5 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-tide/15 text-tide"><MonitorSmartphone aria-hidden="true" className="h-6 w-6" /></span>
            <h1 className="text-2xl font-bold">Staff sign-in</h1>
          </div>
          {form}
        </section>
        <Link to="/" className="inline-flex items-center justify-center gap-2 text-base text-muted underline-offset-2 hover:text-white hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to device chooser
        </Link>
      </main>
    </div>
  )
}
