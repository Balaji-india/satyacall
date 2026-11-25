// / — landing + pick what this laptop plays in the demo: the customer's phone or the bank's
// agent desk. Light-blue page; below the hero the two devices sit on their own side of a soft
// wave: light blue (customer) on the left, deep ocean (agent desk) on the right, the 3D orb
// over the wave. Each device card tilts toward the pointer (off for reduced motion). No data here.
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useSpring } from 'motion/react'
import { ArrowRight, AudioLines, Headset, MessageSquareQuote, ShieldCheck, Smartphone } from 'lucide-react'
import { LogoMark } from '../components/Icons'
import ReduceEffectsToggle from '../components/ReduceEffectsToggle'
import VoiceOrb from '../components/VoiceOrb'

const rise = (delay) => ({
  initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay, ease: 'easeOut' },
})

const FEATURES = [
  [AudioLines, 'Live AI-voice check'],
  [MessageSquareQuote, 'Say-It-Back'],
  [ShieldCheck, 'Verify This Caller'],
]

// The wave between the two halves (viewBox 1000 × 600, stretched to the section).
const WAVE = 'M560 0 C470 120 610 210 515 300 C420 390 570 480 470 600'

export default function DeviceChooser() {
  return (
    <div className="theme-phone sky-bg min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-5 sm:px-10">
        <LogoMark className="h-10 w-10" />
        <span className="font-display text-xl font-bold tracking-tight text-fg">SatyaCall</span>
        <div className="ml-auto"><ReduceEffectsToggle /></div>
      </header>

      <main>
        <motion.section {...rise(0)} className="mx-auto max-w-3xl space-y-5 px-6 pt-6 text-center">
          <h1 className="text-wordmark pb-1 font-display text-6xl font-extrabold leading-none tracking-[-0.03em] sm:text-8xl">SatyaCall</h1>
          <p className="font-display text-3xl font-semibold leading-tight text-fg sm:text-4xl">
            Is it really them? Is it really the bank?
          </p>
          <p className="text-xl">A two-way voice trust layer for bank calls.</p>
          <ul className="flex flex-wrap justify-center gap-2.5 pt-1">
            {FEATURES.map(([Icon, label]) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-full border border-sea/30 bg-sea-tint px-4 py-2 text-base font-semibold text-fg">
                <Icon aria-hidden="true" className="h-4 w-4 text-accent" />{label}
              </li>
            ))}
          </ul>
        </motion.section>

        <section aria-labelledby="pick" className="relative mt-10">
          <h2 id="pick" className="sr-only">Which device is this?</h2>
          {/* Light-blue half, deep-ocean half, soft wave with a gold edge (wide screens). */}
          <div aria-hidden="true" className="absolute inset-0 hidden bg-sky-2/70 md:block">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
              <path d={`${WAVE} L1000 600 L1000 0 Z`} fill="#071a24" />
              <path d={WAVE} fill="none" stroke="#d4af6a" strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 py-12 sm:px-10 md:grid-cols-[1fr_minmax(240px,360px)_1fr] md:py-16">
            <motion.div {...rise(0.1)} className="order-2 md:order-1">
              <DeviceCard to="/customer/login" Icon={Smartphone} title="Customer phone" tag="SatyaBank app"
                text="Call the bank, or check that someone calling you really is from the bank."
                question="Is it really the bank?" />
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}
              className="order-1 mx-auto w-full max-w-[280px] md:order-2 md:max-w-none">
              <VoiceOrb shadow className="w-full md:scale-125" />
            </motion.div>
            <motion.div {...rise(0.16)} className="theme-dark order-3">
              <DeviceCard to="/agent/login" Icon={Headset} title="Bank agent desk" tag="Agent console"
                text="Take customer calls and see, clip by clip, whether the voice can be trusted."
                question="Is it really them?" />
            </motion.div>
          </div>
        </section>

        <footer className="px-6 py-8 text-center text-base">Signals, not proof — a person reviews decisions that matter.</footer>
      </main>
    </div>
  )
}

// A device card that tilts toward the pointer (CSS perspective + motion springs) with a gold
// sheen under the cursor. Reduced motion → no tilt, the gold border glow on hover stays.
function DeviceCard({ to, Icon, title, tag, text, question }) {
  const reduce = useReducedMotion()
  const rotateX = useSpring(0, { stiffness: 160, damping: 18 })
  const rotateY = useSpring(0, { stiffness: 160, damping: 18 })

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    const y = (e.clientY - box.top) / box.height
    e.currentTarget.style.setProperty('--mx', `${x * 100}%`)
    e.currentTarget.style.setProperty('--my', `${y * 100}%`)
    if (reduce) return
    rotateY.set((x - 0.5) * 10)
    rotateX.set((0.5 - y) * 10)
  }
  const onLeave = () => { rotateX.set(0); rotateY.set(0) }

  return (
    <div className="h-full [perspective:1000px]">
      <motion.div style={{ rotateX, rotateY }} className="h-full">
        <Link to={to} onPointerMove={onMove} onPointerLeave={onLeave}
          className="device-card group flex h-full flex-col gap-4 p-7">
          <div className="flex items-center justify-between">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,#0284c7,#0b2533)] text-white ring-1 ring-gold/70 shadow-[0_10px_22px_-10px_rgb(2_132_199/0.8)]">
              <Icon aria-hidden="true" className="h-7 w-7" />
            </span>
            <span className="rounded-full border border-sea/40 bg-sea/10 px-3 py-1 text-base font-medium text-fg">{tag}</span>
          </div>
          <span className="font-display text-3xl font-bold tracking-tight text-fg">{title}</span>
          <span className="text-lg text-muted">{text}</span>
          <span className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-5">
            <span className="font-display text-xl font-semibold text-fg">“{question}”</span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/60 text-accent transition-colors group-hover:bg-gold group-hover:text-ink">
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </span>
          </span>
        </Link>
      </motion.div>
    </div>
  )
}
