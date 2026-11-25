// Header — bank side only (/agent, /enroll): "SatyaBank Agent Desk", one small link
// (Enroll (admin) ↔ back to the desk), and the REAL backend status from GET /api/health.
// Customer pages have their own phone header without any of this.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { errorText, getHealth } from '../api'
import { getSession } from '../session'
import { ShieldIcon } from './Icons'
import SignOutButton from './SignOutButton'

export default function Header() {
  // null = still checking; { ok: true, data } or { ok: false, error } after the request
  const [health, setHealth] = useState(null)
  const onEnroll = useLocation().pathname === '/enroll'
  const session = getSession()

  // Ask the backend once; the result (or the error) goes into state.
  const loadHealth = () =>
    getHealth()
      .then((data) => setHealth({ ok: true, data }))
      .catch((error) => setHealth({ ok: false, error }))

  // Check on first load; clicking the status re-checks.
  useEffect(() => { loadHealth() }, [])
  const checkHealth = () => { setHealth(null); loadHealth() }

  return (
    <header className="border-b border-white/10 bg-paper/60 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4">
        {/* Same wide wordmark as the customer app; "Agent Desk" condensed, so it reads as a sub-brand. */}
        <Link to="/agent" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stamp/20 text-stamp glow-stamp"><ShieldIcon /></span>
          <span className="text-xl font-bold tracking-tight font-stretch-expanded">SatyaBank</span>
          <span className="text-xl text-white/75 font-stretch-condensed">Agent Desk</span>
        </Link>

        {/* The only link: enrolment is an admin task, so it stays small. */}
        {onEnroll
          ? <Link to="/agent" className="text-sm text-white/70 underline hover:text-white">Back to agent desk</Link>
          : <Link to="/enroll" className="text-sm text-white/70 underline hover:text-white">Enroll (admin)</Link>}

        {/* Glass chip; green/red text = the real backend status. */}
        <button onClick={checkHealth} disabled={health === null} className="glass ml-auto px-3 py-1.5 text-left text-sm" title="Click to re-check the backend">
          <HealthText health={health} />
        </button>

        {/* Demo staff sign-in (B10): who is at this desk + Sign out. */}
        {session?.role === 'agent' && (
          <span className="flex items-center gap-2 text-sm text-white/70">
            {session.display_name} · {session.employee_id}
            <SignOutButton role="agent" />
          </span>
        )}
      </div>
    </header>
  )
}

// Only shows what the backend actually returned — no default numbers.
function HealthText({ health }) {
  if (health === null) return <span className="text-slate-500">Backend: checking…</span>
  if (!health.ok) {
    return (
      <span className="text-red-600">
        ● Backend unreachable <span className="text-sm">— {errorText(health.error)} · click to retry</span>
      </span>
    )
  }

  const { credits_balance, detectif_reachable } = health.data
  return (
    <span className="text-green-700">
      ● Backend: connected · credits {credits_balance ?? 'unknown'}
      {detectif_reachable === false && <span className="text-red-600"> · DetectifAI unreachable</span>}
    </span>
  )
}
