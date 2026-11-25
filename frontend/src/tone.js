// tone.js — the four verdict tones (see components/Tone.jsx): lucide icon + Tailwind classes.
// Classes are written out in full so Tailwind finds them.
import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'

export const TONE = {
  pass: { Icon: CheckCircle2, text: 'text-pass-fg', soft: 'bg-pass/10', border: 'border-pass/45', solid: 'bg-pass', mark: '✓' },
  warn: { Icon: AlertTriangle, text: 'text-warn-fg', soft: 'bg-warn/12', border: 'border-warn/50', solid: 'bg-warn', mark: '!' },
  stop: { Icon: XCircle, text: 'text-stop-fg', soft: 'bg-stop/10', border: 'border-stop/50', solid: 'bg-stop', mark: '✗' },
  skip: { Icon: MinusCircle, text: 'text-skip-fg', soft: 'bg-skip/12', border: 'border-skip/40', solid: 'bg-skip', mark: '–' },
}
