// Bank side (/agent, /enroll): the calm agent console. Header + the page + footer, a static
// gradient background (nothing animates behind a live call), and the desk's toasts.
// Used as a layout route (<Outlet />) or wrapped around one page (children), e.g. /enroll.
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from '../components/Header'

export default function AgentLayout({ children }) {
  return (
    <div className="theme-dark desk-bg min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {children ?? <Outlet />}
      </main>
      <footer className="mx-auto max-w-[1400px] px-6 pb-8 text-center text-base text-muted">
        <hr className="rule-gold mx-auto mb-5 max-w-md" />
        Signals, not proof — a person reviews decisions that matter.
      </footer>
      <Toaster theme="dark" position="bottom-right" richColors closeButton toastOptions={{ style: { fontSize: '16px' } }} />
    </div>
  )
}
