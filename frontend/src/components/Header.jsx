// Header — app name, nav bar, and the REAL backend status from GET /api/health.
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getHealth } from '../api'

const LINKS = [
  { to: '/call', label: 'Customer call' },
  { to: '/agent', label: 'Agent console' },
  { to: '/app', label: 'Bank app' },
  { to: '/enroll', label: 'Enroll' },
]

export default function Header() {
  // null = still checking; { ok: true, data } or { ok: false, error } after the request
  const [health, setHealth] = useState(null)

  // Ask the backend once; the result (or the error) goes into state.
  const loadHealth = () =>
    getHealth()
      .then((data) => setHealth({ ok: true, data }))
      .catch((error) => setHealth({ ok: false, error }))

  // Check on first load; clicking the status re-checks.
  useEffect(() => { loadHealth() }, [])
  const checkHealth = () => { setHealth(null); loadHealth() }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <span className="text-lg font-bold">SatyaCall</span>

        <nav className="flex gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded px-3 py-1 text-sm ${isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={checkHealth} className="ml-auto text-sm" title="Re-check backend">
          <HealthText health={health} />
        </button>
      </div>
    </header>
  )
}

// Only shows what the backend actually returned — no default numbers.
function HealthText({ health }) {
  if (health === null) return <span className="text-slate-500">Backend: checking…</span>
  if (!health.ok) return <span className="text-red-600">● Backend unreachable</span>

  const { credits_balance, detectif_reachable } = health.data
  return (
    <span className="text-green-700">
      ● Backend: connected · credits {credits_balance ?? 'unknown'}
      {detectif_reachable === false && <span className="text-red-600"> · DetectifAI unreachable</span>}
    </span>
  )
}
