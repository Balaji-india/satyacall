// /customer/login and /agent/login — DEMO sign-in (B10).
// Pick yourself from GET /api/people (only real enrolled people of this role) + the demo password.
// The password is checked by comparing its SHA-256 with DEMO_PASSWORD_SHA256 (session.js).
// Success → session in sessionStorage → back to the page that sent us here, else /customer or /agent.
// "Create account" → /enroll?signup=<role>: enrolling the voice IS the sign-up.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorText, listPeople } from '../api'
import { DeskIcon, ShieldIcon } from '../components/Icons'
import PhoneFrame from '../components/PhoneFrame'
import { checkDemoPassword, HOME_PATH, saveSession } from '../session'

const FIELD = 'w-full rounded-xl border px-4 py-3 text-lg'

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
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="who" className="block text-sm font-medium">{isAgent ? 'Employee ID' : 'Your name'}</label>
        {people === null && <p className="text-sm text-slate-500">Loading {isAgent ? 'staff' : 'customers'}…</p>}
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
        {people?.length === 0 && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {peopleError
              ? <>Could not load the list — {peopleError}. <button type="button" onClick={retry} className="underline">Retry</button></>
              : <>Nobody is enrolled as {isAgent ? 'staff with an employee ID' : 'a customer'} yet — create an account below.</>}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="pw" className="block text-sm font-medium">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} disabled={checking}
          onChange={(e) => { setPassword(e.target.value); setError('') }} className={FIELD} />
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="space-y-2">
        <button disabled={!chosen || !password || checking}
          className="btn-primary glow-stamp w-full py-4 text-lg disabled:opacity-40 disabled:shadow-none">
          {checking ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-xs text-slate-500">Demo sign-in — a real bank uses its existing login.</p>
      </div>

      <p className="text-center text-sm text-slate-600">
        New here? <Link to={`/enroll?signup=${role}`} className="font-semibold text-tide underline">Create account</Link>
      </p>
    </form>
  )

  if (!isAgent) {
    return (
      <PhoneFrame>
        <div className="flex-1 space-y-6 px-5 pb-8 pt-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Sign in</h1>
            <p className="text-slate-600">Welcome back to SatyaBank.</p>
          </div>
          {form}
        </div>
      </PhoneFrame>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10 text-ink">
      <div className="flex items-center justify-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-stamp/20 text-stamp glow-stamp"><ShieldIcon /></span>
        <span className="text-glow text-2xl font-bold tracking-tight font-stretch-expanded">SatyaBank</span>
        <span className="text-2xl text-white/75 font-stretch-condensed">Staff</span>
      </div>
      <section className="glass space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-tide/15 text-tide"><DeskIcon /></span>
          <h1 className="text-2xl font-bold">SatyaBank Staff sign-in</h1>
        </div>
        {form}
      </section>
      <Link to="/" className="text-center text-sm text-slate-500 underline">Back to device chooser</Link>
    </main>
  )
}
