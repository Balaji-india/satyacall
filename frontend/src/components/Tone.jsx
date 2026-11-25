// Tone — the four verdict colours, identical on both devices, ALWAYS with an icon + a word:
//   pass = real / match / approved · warn = retry / mixed / unavailable
//   stop = AI / no match / fallback · skip = skipped / not checked
// Classes are written out in full so Tailwind finds them.
import { AnimatePresence, motion } from 'motion/react'
import { TONE } from '../tone'

export function ToneIcon({ tone, className = 'h-5 w-5' }) {
  const { Icon, text } = TONE[tone] ?? TONE.skip
  return <Icon aria-hidden="true" className={`${className} shrink-0 ${text}`} />
}

// Pill: icon + word. `swapKey` changes → the pill animates in again (badge "on change").
export function Pill({ tone, children, swapKey, className = '' }) {
  const t = TONE[tone] ?? TONE.skip
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={swapKey ?? tone}
        initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${t.border} ${t.soft} ${t.text} ${className}`}>
        <t.Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

// Fade/slide-in wrapper for result cards (≤ 400 ms; off for reduced motion via MotionConfig).
export function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  )
}

// "How it decided": one plain-English line under a result, built from the response fields.
export function HowItDecided({ children }) {
  return (
    <p className="border-l-2 border-tide pl-3 text-base text-muted">
      <span className="font-semibold text-fg">How it decided: </span>{children}
    </p>
  )
}
