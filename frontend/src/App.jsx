// App — header on every page + the four routes (docs/PLAN.md §4).
import { Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/agent" replace />} />
          <Route path="/call" element={
            <Placeholder title="Customer call" task="B2"
              description="The customer calls the bank's agent desk over WebRTC (PeerJS)." />
          } />
          <Route path="/agent" element={
            <Placeholder title="Agent console" task="B2–B4"
              description="Live trust timeline, call state, Say-It-Back and evidence for the call." />
          } />
          <Route path="/app" element={
            <Placeholder title="Bank app — Verify This Caller" task="B6"
              description="Customer checks whether a caller claiming to be from the bank is real." />
          } />
          <Route path="/enroll" element={
            <Placeholder title="Enroll a voice" task="B5"
              description="Record a 20–30 s sample to enroll a customer or agent." />
          } />
          <Route path="*" element={<Placeholder title="Page not found" task="—" description="Use the nav bar above." />} />
        </Routes>
      </main>
    </div>
  )
}
