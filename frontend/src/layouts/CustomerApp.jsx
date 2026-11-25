// /customer — the customer's phone: a "SatyaBank" app, phone width, tab bar at the bottom.
// The tab lives in the URL (?tab=call | ?tab=verify) so /call and /app can redirect here.
// Both tabs stay MOUNTED (the other one is only hidden): switching to "Verify caller" during a
// call must not unmount CallPage, or its PeerJS call would hang up.
// No agent links, no credits, no backend status here — this is what a customer would see.
// On a laptop the app sits in a phone-shaped frame; on a real phone it fills the screen.
import { useSearchParams } from 'react-router-dom'
import AppPage from '../pages/AppPage'
import CallPage from '../pages/CallPage'

const TABS = [['call', 'Call bank'], ['verify', 'Verify caller']]

export default function CustomerApp() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'verify' ? 'verify' : 'call'

  return (
    <div className="min-h-screen bg-paper text-ink sm:py-8">
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-white sm:min-h-[780px] sm:overflow-hidden sm:rounded-[2.5rem] sm:border-[10px] sm:border-ink">
        <header className="px-5 pb-3 pt-5">
          <p className="text-2xl font-bold tracking-tight text-stamp font-stretch-expanded">SatyaBank</p>
        </header>

        <div className="flex-1 px-5 pb-6">
          <div hidden={tab !== 'call'}><CallPage /></div>
          <div hidden={tab !== 'verify'}><AppPage /></div>
        </div>

        {/* Bottom tab bar, like a banking app. Active tab = violet text + bar on top. */}
        <nav role="tablist" className="sticky bottom-0 grid grid-cols-2 border-t bg-white">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key}
              onClick={() => setParams({ tab: key }, { replace: true })}
              className={`border-t-4 py-4 text-base font-semibold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-stamp ${tab === key ? 'border-stamp text-stamp' : 'border-transparent text-ink/60'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
