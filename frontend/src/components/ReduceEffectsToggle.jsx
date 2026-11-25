// "Reduce effects" switch for the agent and customer headers: keeps calm mode on (see effects.js).
import { useReduceEffects } from '../effects'

export default function ReduceEffectsToggle() {
  const [on, toggle] = useReduceEffects()
  return (
    <button type="button" onClick={toggle} aria-pressed={on}
      title="Stops background animation and blur so the call and recording run smoother"
      className={`rounded-lg border px-2 py-1 text-sm ${on ? 'border-tide/60 bg-tide/15 text-white' : 'text-white/70 hover:text-white'}`}>
      {on ? 'Effects: reduced' : 'Reduce effects'}
    </button>
  )
}
