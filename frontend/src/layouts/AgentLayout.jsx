// Bank side (/agent, /enroll): "SatyaBank Agent Desk" header + the page + footer.
import { Outlet } from 'react-router-dom'
import Header from '../components/Header'

export default function AgentLayout() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:p-4">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-6 text-center text-sm text-ink/60">
        Signals, not proof. A person reviews decisions that matter.
      </footer>
    </div>
  )
}
