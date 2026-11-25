// App — header on every page + the four routes (docs/PLAN.md §4).
import { Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import AgentPage from './pages/AgentPage'
import AppPage from './pages/AppPage'
import CallPage from './pages/CallPage'
import EnrollPage from './pages/EnrollPage'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/agent" replace />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/enroll" element={<EnrollPage />} />
          <Route path="*" element={<Placeholder title="Page not found" task="—" description="Use the nav bar above." />} />
        </Routes>
      </main>
    </div>
  )
}
