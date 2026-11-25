// App — routes. The demo runs on two laptops, so each device gets its own view:
//   /          → chooser: "This device is: Customer phone | Bank agent desk"
//   /customer  → phone-style SatyaBank app (tabs: Call bank, Verify caller) — no agent links, no credits
//   /agent     → SatyaBank Agent Desk (agent console + small "Enroll (admin)" link)
//   /enroll    → admin enrolment (reached from the agent desk)
// Old links keep working: /call → /customer?tab=call, /app → /customer?tab=verify.
import { Navigate, Route, Routes } from 'react-router-dom'
import AgentLayout from './layouts/AgentLayout'
import CustomerApp from './layouts/CustomerApp'
import AgentPage from './pages/AgentPage'
import DeviceChooser from './pages/DeviceChooser'
import EnrollPage from './pages/EnrollPage'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DeviceChooser />} />
      <Route path="/customer" element={<CustomerApp />} />
      <Route path="/call" element={<Navigate to="/customer?tab=call" replace />} />
      <Route path="/app" element={<Navigate to="/customer?tab=verify" replace />} />
      <Route element={<AgentLayout />}>
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/enroll" element={<EnrollPage />} />
        <Route path="*" element={<Placeholder title="Page not found" description="This page does not exist — go back to the start page." />} />
      </Route>
    </Routes>
  )
}
