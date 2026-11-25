// / — pick what this laptop plays in the demo: the customer's phone or the bank's agent desk.
// Hero: the product name and the two questions it answers. Each tile previews its device's look
// (light phone app vs dark console) and carries the question that device answers. No data here.
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, MonitorSmartphone, Smartphone } from 'lucide-react'
import { LogoMark } from '../components/Icons'

const rise = (delay) => ({
  initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: 'easeOut' },
})

export default function DeviceChooser() {
  return (
    <div className="theme-dark desk-bg min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-12 px-6 py-12">
        <motion.header {...rise(0)} className="space-y-6">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <h1 className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl">SatyaCall</h1>
          </div>
          <p className="max-w-4xl font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
            Is it really them?<br />
            <span className="text-[#aebbd0]">Is it really the bank?</span>
          </p>
          <p className="max-w-2xl text-lg text-muted">
            A voice trust layer for bank calls: the bank checks the customer's voice is real and theirs, and the
            customer checks the caller is really from the bank.
          </p>
        </motion.header>

        <section aria-labelledby="pick" className="space-y-4">
          <h2 id="pick" className="text-xl font-semibold text-white">Which device is this?</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Customer phone tile — previews the light SatyaBank app. */}
            <motion.div {...rise(0.08)}>
              <Link to="/customer/login"
                className="theme-light group flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-mist p-7 text-navy transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-stamp text-white"><Smartphone aria-hidden="true" className="h-7 w-7" /></span>
                  <span className="rounded-full bg-white px-3 py-1 text-[15px] font-semibold text-stamp shadow-sm">SatyaBank app</span>
                </div>
                <span className="font-display text-3xl font-bold">Customer phone</span>
                <span className="text-lg text-muted">Call the bank, or check that someone calling you really is from the bank.</span>
                <span className="mt-auto flex items-center justify-between border-t border-line pt-4 font-semibold">
                  <span className="text-lg">“Is it really the bank?”</span>
                  <ArrowRight aria-hidden="true" className="h-5 w-5 text-stamp transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>

            {/* Agent desk tile — previews the dark console. */}
            <motion.div {...rise(0.14)}>
              <Link to="/agent/login"
                className="group flex h-full flex-col gap-4 rounded-2xl border border-tide/30 bg-panel p-7 text-white transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-tide/15 text-tide"><MonitorSmartphone aria-hidden="true" className="h-7 w-7" /></span>
                  <span className="rounded-full border border-tide/40 px-3 py-1 text-[15px] font-semibold text-tide">Security console</span>
                </div>
                <span className="font-display text-3xl font-bold">Bank agent desk</span>
                <span className="text-lg text-muted">Take customer calls and see, clip by clip, whether the voice can be trusted.</span>
                <span className="mt-auto flex items-center justify-between border-t border-white/10 pt-4 font-semibold">
                  <span className="text-lg">“Is it really them?”</span>
                  <ArrowRight aria-hidden="true" className="h-5 w-5 text-tide transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          </div>
        </section>

        <footer className="text-base text-muted">Signals, not proof — a person reviews decisions that matter.</footer>
      </main>
    </div>
  )
}
