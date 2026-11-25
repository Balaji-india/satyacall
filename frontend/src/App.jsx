// App — routes. The demo runs on two laptops, so each device gets its own view:
//   /                → chooser: "This device is: Customer phone | Bank agent desk" (tiles → sign-in)
//   /customer/login  → customer demo sign-in;  /agent/login → staff demo sign-in (B10)
//   /customer        → phone-style SatyaBank app (tabs: Call bank, Verify caller) — customer session
//   /agent           → SatyaBank Agent Desk — agent session
//   /enroll          → admin enrolment (agent session), or sign-up via /enroll?signup=customer|agent
// Old links keep working: /call → /customer?tab=call, /app → /customer?tab=verify.
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import AgentLayout from './layouts/AgentLayout'
import CustomerApp from './layouts/CustomerApp'
import RequireSession from './components/RequireSession'
import AgentPage from './pages/AgentPage'
import DeviceChooser from './pages/DeviceChooser'
import EnrollPage from './pages/EnrollPage'
import LoginPage from './pages/LoginPage'
import Placeholder from './pages/Placeholder'
import SignupLayout from './layouts/SignupLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DeviceChooser />} />
      <Route path="/customer/login" element={<LoginPage role="customer" />} />
      <Route path="/agent/login" element={<LoginPage role="agent" />} />
      <Route path="/customer" element={<RequireSession role="customer"><CustomerApp /></RequireSession>} />
      <Route path="/call" element={<Navigate to="/customer?tab=call" replace />} />
      <Route path="/app" element={<Navigate to="/customer?tab=verify" replace />} />
      <Route path="/enroll" element={<EnrollRoute />} />
      <Route element={<AgentLayout />}>
        <Route path="/agent" element={<RequireSession role="agent"><AgentPage /></RequireSession>} />
        <Route path="*" element={<Placeholder title="Page not found" description="This page does not exist — go back to the start page." />} />
      </Route>
    </Routes>
  )
}

// /enroll?signup=customer|agent → sign-up (no session needed, enrolling the voice IS the sign-up).
// Plain /enroll → admin enrolment on the agent desk, needs an agent session.
function EnrollRoute() {
  const signup = useSearchParams()[0].get('signup')
  if (signup === 'customer' || signup === 'agent') {
    return <SignupLayout role={signup}><EnrollPage signup={signup} /></SignupLayout>
  }
  return (
    <RequireSession role="agent">
      <AgentLayout><EnrollPage /></AgentLayout>
    </RequireSession>
  )
}
