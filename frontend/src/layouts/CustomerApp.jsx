// /customer — the customer's phone: a "SatyaBank" app, phone width, tab bar at the bottom.
// The tab lives in the URL (?tab=call | ?tab=verify) so /call and /app can redirect here.
// Both tabs stay MOUNTED (the other one is only hidden): switching to "Verify caller" during a
// call must not unmount CallPage, or its PeerJS call would hang up.
// No agent links, no credits, no backend status here — this is what a customer would see.
// Needs a customer session (RequireSession in App.jsx); "Sign out" ends it.
import { useSearchParams } from 'react-router-dom'
import { PhoneCall, ShieldCheck } from 'lucide-react'
import AppPage from '../pages/AppPage'
import CallPage from '../pages/CallPage'
import PhoneFrame from '../components/PhoneFrame'
import SignOutButton from '../components/SignOutButton'

const TABS = [['call', 'Call bank', PhoneCall], ['verify', 'Verify caller', ShieldCheck]]

export default function CustomerApp() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'verify' ? 'verify' : 'call'

  // Bottom tab bar, like a banking app. Active tab = ocean icon in a light-blue pill + ocean label.
  const tabBar = (
    <nav role="tablist" className="sticky bottom-0 z-10 grid grid-cols-2 border-t border-line bg-white px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
      {TABS.map(([key, label, Icon]) => (
        <button key={key} role="tab" aria-selected={tab === key}
          onClick={() => setParams({ tab: key }, { replace: true })}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-base font-semibold transition-colors focus-visible:-outline-offset-4 ${tab === key ? 'text-ocean-2' : 'text-muted hover:text-fg'}`}>
          <span aria-hidden="true" className={`grid h-8 w-16 place-items-center rounded-full transition-colors ${tab === key ? 'bg-sky-2 text-ocean ring-1 ring-gold/60' : ''}`}>
            <Icon className="h-5 w-5" strokeWidth={tab === key ? 2.3 : 2} />
          </span>
          {label}
        </button>
      ))}
    </nav>
  )

  return (
    <PhoneFrame right={<SignOutButton role="customer" />} footer={tabBar}>
      <div className="px-5 pb-8 pt-5">
        <div hidden={tab !== 'call'}><CallPage /></div>
        <div hidden={tab !== 'verify'}><AppPage /></div>
      </div>
    </PhoneFrame>
  )
}
