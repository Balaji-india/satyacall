// PhoneFrame — the customer's "SatyaBank" phone: phone-shaped frame on a laptop, full screen on a
// real phone. Used by the customer app and its sign-in page. `right` = header slot (Sign out).
import { ShieldIcon } from './Icons'

export default function PhoneFrame({ right, children }) {
  return (
    <div className="min-h-screen text-ink sm:py-8">
      {/* Phone frame (laptop only): dark bezel, notch, a faint diagonal reflection. */}
      <div className="phone mx-auto flex min-h-screen max-w-[420px] flex-col sm:min-h-[780px] sm:overflow-hidden sm:rounded-[2.5rem] sm:border-[10px] sm:border-[#1a2238] sm:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_120px_-30px_rgb(109_93_252/0.45)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(125deg,rgb(255_255_255/0.07)_0%,transparent_35%)] sm:block" />
        <div aria-hidden="true" className="mx-auto hidden h-6 w-32 rounded-b-2xl bg-[#1a2238] sm:block" />
        <header className="relative flex items-center gap-2 px-5 pb-3 pt-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stamp/20 text-stamp glow-stamp"><ShieldIcon className="h-5 w-5" /></span>
          <p className="text-glow text-2xl font-bold tracking-tight font-stretch-expanded">SatyaBank</p>
          {right && <div className="ml-auto">{right}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}
