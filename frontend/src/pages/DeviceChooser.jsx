// / — pick what this laptop plays in the demo: the customer's phone or the bank's agent desk.
// Hero: name, the two questions SatyaCall answers, and a voice waveform (decoration, no data).
import { Link } from 'react-router-dom'
import { DeskIcon, PhoneIcon } from '../components/Icons'

const TILE = 'glass group flex flex-col gap-3 p-8 transition hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4'

export default function DeviceChooser() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-12 px-6 py-12">
      <header className="space-y-5 text-center">
        <div className="wave mx-auto w-fit" aria-hidden="true">
          {Array.from({ length: 21 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 7) * 0.12 + Math.floor(i / 7) * 0.05}s`, opacity: 0.45 + ((i * 37) % 55) / 100 }} />
          ))}
        </div>
        <h1 className="text-glow text-6xl font-bold tracking-tight font-stretch-expanded sm:text-7xl">SatyaCall</h1>
        <p className="text-2xl text-slate-600">Is it really them? Is it really the bank?</p>
      </header>

      <p className="text-center text-lg text-slate-500">This device is…</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Link to="/customer/login" className={`${TILE} hover:glow-stamp`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-stamp/20 text-stamp glow-stamp"><PhoneIcon className="h-7 w-7" /></span>
          <span className="text-3xl font-bold font-stretch-expanded">Customer phone</span>
          <span className="text-lg text-slate-600">Call the bank, or check that someone calling you really is from the bank.</span>
        </Link>

        <Link to="/agent/login" className={`${TILE} hover:glow-pass`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-tide/15 text-tide"><DeskIcon className="h-7 w-7" /></span>
          <span className="text-3xl font-bold font-stretch-expanded">Bank agent desk</span>
          <span className="text-lg text-slate-600">Take customer calls and see, clip by clip, whether the voice can be trusted.</span>
        </Link>
      </div>

      <footer className="text-center text-sm text-slate-500">Signals, not proof — a person reviews decisions that matter.</footer>
    </main>
  )
}
