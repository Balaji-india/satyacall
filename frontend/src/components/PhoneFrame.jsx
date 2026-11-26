// PhoneFrame — the customer's "SatyaBank" mobile banking app. Two looks:
//   real phone (viewport ≤ 480 px): full screen, no frame, like a native app — header and tab bar
//     are padded with env(safe-area-inset-*) so nothing sits under the notch or the home bar.
//   laptop (> 480 px): a light-blue app inside a deep-ocean phone with a thin gold bezel line.
// Used by the customer app and its sign-in page.
// `right` = header slot (Sign out), `footer` = bottom tab bar, `overlay` = full-screen layer over
// the whole app (the call screen) — fills the real screen on a phone, the frame on a laptop.
// `aside` (sign-in page only) = shown to the LEFT of the phone on wide screens (the 3D orb).
// No 3D or animated background here — the call screen stays light on the CPU.
import { Toaster } from 'sonner'
import { LogoMark } from './Icons'

export default function PhoneFrame({ right, footer, overlay, aside, children }) {
  return (
    <div className="theme-phone sky-bg min-h-dvh min-[481px]:py-8 lg:flex lg:items-center lg:justify-center lg:gap-20 lg:px-10">
      {aside}
      <div className="relative mx-auto flex h-dvh w-full shrink-0 flex-col overflow-hidden bg-sky min-[481px]:h-[min(860px,calc(100dvh-4rem))] min-[481px]:max-w-[420px] min-[481px]:rounded-[3.25rem] min-[481px]:border-[10px] min-[481px]:border-deep min-[481px]:shadow-[0_0_0_1.5px_#d4af6a,0_0_0_5px_rgb(212_175_106/0.12),0_50px_90px_-40px_rgb(11_37_51/0.55)] lg:mx-0">
        {/* Camera pill (laptop frame only). Above the call screen, like real hardware. */}
        <div aria-hidden="true" className="absolute left-1/2 top-2.5 z-20 hidden h-7 w-28 -translate-x-1/2 rounded-full bg-deep min-[481px]:block" />

        <header className="relative z-10 flex items-center gap-2.5 bg-[linear-gradient(180deg,#0284c7,#0373ad)] pb-3.5 pl-[max(env(safe-area-inset-left),1.25rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)] text-white shadow-[0_6px_20px_-10px_rgb(2_132_199/0.8)] min-[481px]:pt-12">
          <LogoMark className="h-9 w-9" />
          <p className="font-display text-xl font-extrabold tracking-tight">SatyaBank</p>
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">{children}</div>
        {footer}
        {overlay}
      </div>
      <Toaster theme="light" position="top-center" richColors closeButton
        offset={{ top: 'max(env(safe-area-inset-top), 16px)' }} mobileOffset={{ top: 'max(env(safe-area-inset-top), 12px)' }}
        toastOptions={{ style: { fontSize: '16px' } }} />
    </div>
  )
}
