// Bank side (/agent, /enroll): dark security console. Header + the page + footer, the (very
// subtle) background effects, and the desk's toasts.
// Used as a layout route (<Outlet />) or wrapped around one page (children), e.g. /enroll.
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import CyberBackground from '../components/CyberBackground'
import Header from '../components/Header'

export default function AgentLayout({ children }) {
  return (
    <div className="theme-dark desk-bg min-h-screen">
      <CyberBackground />
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        {children ?? <Outlet />}
      </main>
      <footer className="mx-auto max-w-[1400px] px-6 pb-6 text-center text-base text-muted">
        Signals, not proof — a person reviews decisions that matter.
      </footer>
      <Toaster theme="dark" position="bottom-right" richColors closeButton toastOptions={{ style: { fontSize: '16px' } }} />
    </div>
  )
}
