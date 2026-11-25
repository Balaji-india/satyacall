// /customer — the customer's phone: a "SatyaBank" app, phone width, tab bar at the bottom.
// The tab lives in the URL (?tab=call | ?tab=verify) so /call and /app can redirect here.
// Both tabs stay MOUNTED (the other one is only hidden): switching to "Verify caller" during a
// call must not unmount CallPage, or its PeerJS call would hang up.
// No agent links, no credits, no backend status here — this is what a customer would see.
// On a laptop the app sits in a phone-shaped frame; on a real phone it fills the screen.
import { useSearchParams } from 'react-router-dom'
import AppPage from '../pages/AppPage'
import CallPage from '../pages/CallPage'
import { ShieldIcon } from '../components/Icons'

const TABS = [['call', 'Call bank'], ['verify', 'Verify caller']]

export default function CustomerApp() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'verify' ? 'verify' : 'call'

  return (
    <div className="min-h-screen text-ink sm:py-8">
      {/* Phone frame (laptop only): dark bezel, notch, a faint diagonal reflection. */}
      <div className="phone mx-auto flex min-h-screen max-w-[420px] flex-col sm:min-h-[780px] sm:overflow-hidden sm:rounded-[2.5rem] sm:border-[10px] sm:border-[#1a2238] sm:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_120px_-30px_rgb(109_93_252/0.45)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(125deg,rgb(255_255_255/0.07)_0%,transparent_35%)] sm:block" />
        <div aria-hidden="true" className="mx-auto hidden h-6 w-32 rounded-b-2xl bg-[#1a2238] sm:block" />
        <header className="flex items-center gap-2 px-5 pb-3 pt-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stamp/20 text-stamp glow-stamp"><ShieldIcon className="h-5 w-5" /></span>
          <p className="text-glow text-2xl font-bold tracking-tight font-stretch-expanded">SatyaBank</p>
        </header>

        <div className="relative flex-1 px-5 pb-6">
          <div hidden={tab !== 'call'}><CallPage /></div>
          <div hidden={tab !== 'verify'}><AppPage /></div>
        </div>

        {/* Bottom tab bar, like a banking app. Active tab = indigo text + bar on top. */}
        <nav role="tablist" className="sticky bottom-0 grid grid-cols-2 border-t bg-[#0a1224]/90 backdrop-blur">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key}
              onClick={() => setParams({ tab: key }, { replace: true })}
              className={`border-t-4 py-4 text-base font-semibold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-tide ${tab === key ? 'border-stamp text-white text-glow' : 'border-transparent text-ink/60'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
