// Brand mark + the check mark that draws itself. All other icons come from lucide-react.
// Decorative: the text next to each icon carries the meaning.
import { motion } from 'motion/react'

// SatyaBank / SatyaCall mark: indigo tile, a shield with a voice wave through it.
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-xl bg-stamp text-white ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.4-7.5 10-4.4-1.6-7.5-5.4-7.5-10V5.8l7.5-3z" />
        <path d="M7.5 12h1.6l1.2-2.6 1.8 5.2 1.6-4 .9 1.4h1.9" stroke="#5eead4" />
      </svg>
    </span>
  )
}

// Check mark that draws itself (approved / verified). ≤ 400 ms; MotionConfig turns it off for
// reduced motion.
export function DrawCheck({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }} />
    </svg>
  )
}
