// "Reduce effects" switch for the agent desk header: keeps calm mode on (see effects.js).
import { Sparkles } from 'lucide-react'
import { useReduceEffects } from '../effects'

export default function ReduceEffectsToggle() {
  const [on, toggle] = useReduceEffects()
  return (
    <button type="button" onClick={toggle} aria-pressed={on}
      title="Stops background animation so the call and recording run smoother"
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-base font-medium transition-colors ${on ? 'border-gold/60 bg-gold/15 text-fg' : 'border-line text-muted hover:text-fg'}`}>
      <Sparkles aria-hidden="true" className="h-4 w-4" />
      {on ? 'Effects reduced' : 'Reduce effects'}
    </button>
  )
}
