// PhoneFrame — the customer's "SatyaBank" mobile banking app: a light-blue app in a deep-ocean
// phone with a thin gold bezel line on a laptop, full screen on a real phone. Used by the
// customer app and its sign-in page.
// `right` = header slot (Sign out), `footer` = bottom tab bar.
// `aside` (sign-in page only) = shown to the LEFT of the phone on wide screens (the 3D orb).
// No 3D or animated background here — the call screen stays light on the CPU.
import { Toaster } from 'sonner'
import { LogoMark } from './Icons'

export default function PhoneFrame({ right, footer, aside, children }) {
  return (
    <div className="theme-phone sky-bg min-h-screen sm:py-8 lg:flex lg:items-center lg:justify-center lg:gap-20 lg:px-10">
      {aside}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[420px] shrink-0 flex-col bg-sky sm:h-[min(860px,calc(100vh-4rem))] sm:min-h-0 sm:overflow-hidden sm:rounded-[3.25rem] sm:border-[10px] sm:border-deep sm:shadow-[0_0_0_1.5px_#d4af6a,0_0_0_5px_rgb(212_175_106/0.12),0_50px_90px_-40px_rgb(11_37_51/0.55)] lg:mx-0">
        {/* Camera pill (laptop only). */}
        <div aria-hidden="true" className="absolute left-1/2 top-2.5 z-20 hidden h-7 w-28 -translate-x-1/2 rounded-full bg-deep sm:block" />

        <header className="relative z-10 flex items-center gap-2.5 bg-[linear-gradient(180deg,#0284c7,#0373ad)] px-5 pb-3.5 pt-4 text-white shadow-[0_6px_20px_-10px_rgb(2_132_199/0.8)] sm:pt-12">
          <LogoMark className="h-9 w-9" />
          <p className="font-display text-xl font-extrabold tracking-tight">SatyaBank</p>
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer}
      </div>
      <Toaster theme="light" position="top-center" richColors closeButton toastOptions={{ style: { fontSize: '16px' } }} />
    </div>
  )
}
