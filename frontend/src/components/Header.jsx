// Header — bank side only (/agent, /enroll): "SatyaBank Agent desk", one small link
// (Enroll (admin) ↔ back to the desk), and the REAL backend status from GET /api/health.
// Customer pages have their own phone header without any of this.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Server, ServerOff, UserPlus, UserRound } from 'lucide-react'
import { errorText, getHealth } from '../api'
import { getSession } from '../session'
import { LogoMark } from './Icons'
import ReduceEffectsToggle from './ReduceEffectsToggle'
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

  const link = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium text-muted hover:bg-gold/5 hover:text-fg'

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/agent" className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold tracking-tight text-fg">SatyaBank</span>
          <span className="rounded-md border border-gold/50 bg-gold/10 px-2 py-0.5 text-base font-semibold text-accent">Agent desk</span>
        </Link>

        {/* The only link: enrolment is an admin task, so it stays small. */}
        {onEnroll
          ? <Link to="/agent" className={link}><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to agent desk</Link>
          : <Link to="/enroll" className={link}><UserPlus aria-hidden="true" className="h-4 w-4" />Enroll (admin)</Link>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReduceEffectsToggle />
          <HealthChip health={health} onRetry={checkHealth} />
          {/* Demo staff sign-in (B10): who is at this desk + Sign out. */}
          {session?.role === 'agent' && (
            <>
              <span className="inline-flex items-center gap-2 px-2 text-base text-fg">
                <UserRound aria-hidden="true" className="h-4 w-4 text-muted" />
                {session.display_name}
                <span className="font-mono text-muted">{session.employee_id}</span>
              </span>
              <SignOutButton role="agent" />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// Only shows what the backend actually returned — no default numbers. Click = re-check.
function HealthChip({ health, onRetry }) {
  const base = 'inline-flex max-w-[28rem] items-center gap-2 rounded-lg border px-3 py-2 text-left text-base font-semibold'
  if (health === null) {
    return <span className={`${base} border-line text-muted`}><Server aria-hidden="true" className="h-4 w-4 ringing" />Backend: checking…</span>
  }
  if (!health.ok) {
    return (
      <button onClick={onRetry} title={`${errorText(health.error)} — click to retry`}
        className={`${base} border-stop/50 bg-stop/10 text-stop-fg hover:bg-stop/20`}>
        <ServerOff aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="shrink-0">Backend unreachable</span>
        <span className="font-normal text-fg/80 underline underline-offset-2">Retry</span>
      </button>
    )
  }
  const { credits_balance, detectif_reachable } = health.data
  return (
    <button onClick={onRetry} title="Click to re-check the backend"
      className={`${base} ${detectif_reachable === false ? 'border-warn/50 bg-warn/10 text-warn-fg' : 'border-pass/45 bg-pass/10 text-pass-fg'}`}>
      <Server aria-hidden="true" className="h-4 w-4 shrink-0" />
      Backend connected
      {detectif_reachable === false && <span> · DetectifAI unreachable</span>}
      <span className="font-normal text-fg/80">· credits <span className="font-mono">{credits_balance ?? 'unknown'}</span></span>
    </button>
  )
}
