// /customer — the customer's phone: a "SatyaBank" app, phone width, tab bar at the bottom.
// The tab lives in the URL (?tab=call | ?tab=verify) so /call and /app can redirect here.
// Both tabs stay MOUNTED (the other one is only hidden): switching to "Verify caller" during a
// call must not unmount CallPage, or its PeerJS call would hang up.
// No agent links, no credits, no backend status here — this is what a customer would see.
// Needs a customer session (RequireSession in App.jsx); "Sign out" ends it.
import { useSearchParams } from 'react-router-dom'
import AppPage from '../pages/AppPage'
import CallPage from '../pages/CallPage'
import PhoneFrame from '../components/PhoneFrame'
import SignOutButton from '../components/SignOutButton'

const TABS = [['call', 'Call bank'], ['verify', 'Verify caller']]

export default function CustomerApp() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'verify' ? 'verify' : 'call'

  return (
    <PhoneFrame right={<SignOutButton role="customer" />}>
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
    </PhoneFrame>
  )
}
