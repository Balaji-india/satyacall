// PhoneFrame — the customer's "SatyaBank" mobile banking app: a light phone in a dark bezel on a
// laptop, full screen on a real phone. Used by the customer app and its sign-in page.
// `right` = header slot (Sign out), `footer` = bottom tab bar. No background effects here.
import { Toaster } from 'sonner'
import { LogoMark } from './Icons'

export default function PhoneFrame({ right, footer, children }) {
  return (
    <div className="theme-light min-h-screen bg-[#e4e9f2] sm:bg-[radial-gradient(60%_50%_at_50%_0%,#ffffff_0%,#e4e9f2_70%)] sm:py-8">
      <div className="relative mx-auto flex min-h-screen max-w-[420px] flex-col bg-mist sm:h-[min(840px,calc(100vh-4rem))] sm:min-h-0 sm:overflow-hidden sm:rounded-[3rem] sm:border-[12px] sm:border-navy sm:shadow-[0_40px_90px_-30px_rgb(11_31_58/0.55),0_0_0_1px_rgb(11_31_58/0.4)]">
        {/* Notch (laptop only). */}
        <div aria-hidden="true" className="absolute left-1/2 top-0 z-20 hidden h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-navy sm:block" />

        <header className="relative z-10 flex items-center gap-2.5 border-b border-line bg-white px-5 pb-3 pt-4 sm:pt-8">
          <LogoMark className="h-9 w-9" />
          <p className="font-display text-xl font-extrabold tracking-tight text-navy">SatyaBank</p>
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer}
      </div>
      <Toaster theme="light" position="top-center" richColors closeButton toastOptions={{ style: { fontSize: '16px' } }} />
    </div>
  )
}
