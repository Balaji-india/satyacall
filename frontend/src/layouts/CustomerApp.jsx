// /customer — the customer's phone: a "SatyaBank" app, tab bar at the bottom. Full screen on a real
// phone (≤ 480 px), inside a phone frame on a laptop (PhoneFrame).
// The tab lives in the URL (?tab=call | ?tab=verify) so /call and /app can redirect here.
// The call (usePeerCall) lives HERE, above both tabs, so switching to "Verify caller" during a
// call never hangs up. Both tabs stay mounted (the other one is only hidden) so their own state
// survives too.
// Ringing / in a call → PhoneCallScreen (native-style, full screen). During a call the customer
// can jump to "Verify caller"; a green "Return to call" bar brings them back. An incoming call
// shows the call screen on either tab.
// No agent links, no credits, no backend status here — this is what a customer would see.
// Needs a customer session (RequireSession in App.jsx); "Sign out" ends it.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneCall, ShieldCheck, Volume2 } from 'lucide-react'
import AppPage from '../pages/AppPage'
import CallPage from '../pages/CallPage'
import PhoneCallScreen from '../components/PhoneCallScreen'
import PhoneFrame from '../components/PhoneFrame'
import SignOutButton from '../components/SignOutButton'
import { usePeerCall } from '../usePeerCall'
import { formatClock, useCallClock } from '../useCallClock'

const TABS = [['call', 'Call bank', PhoneCall], ['verify', 'Verify caller', ShieldCheck]]

export default function CustomerApp() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'verify' ? 'verify' : 'call'
  const setTab = (key) => setParams({ tab: key }, { replace: true })

  const call = usePeerCall()
  const inCall = call.status === 'in-call'
  const live = call.status === 'ringing' || inCall
  const secs = useCallClock(inCall)
  const [speakerOn, setSpeakerOn] = useState(true) // Speaker (1.0) vs Private (0.35), see PhoneCallScreen
  const showCallScreen = live && (tab === 'call' || call.incoming)

  // Bottom tab bar, like a banking app. Active tab = ocean icon in a light-blue pill + ocean label.
  const tabBar = (
    <nav role="tablist" className="z-10 grid grid-cols-2 border-t border-line bg-white pb-[max(env(safe-area-inset-bottom),0.5rem)] pl-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pt-2">
      {TABS.map(([key, label, Icon]) => (
        <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-base font-semibold transition-colors focus-visible:-outline-offset-4 ${tab === key ? 'text-ocean-2' : 'text-muted hover:text-fg'}`}>
          <span aria-hidden="true" className={`grid h-8 w-16 place-items-center rounded-full transition-colors ${tab === key ? 'bg-sky-2 text-ocean ring-1 ring-gold/60' : ''}`}>
            <Icon className="h-5 w-5" strokeWidth={tab === key ? 2.3 : 2} />
          </span>
          {label}
        </button>
      ))}
    </nav>
  )

  const overlay = (
    <PhoneCallScreen call={call} show={showCallScreen} secs={secs} speakerOn={speakerOn} onSpeaker={setSpeakerOn}
      onVerify={() => setTab('verify')} />
  )

  return (
    <PhoneFrame right={<SignOutButton role="customer" />} footer={tabBar} overlay={overlay}>
      {/* In a call but on the Verify tab: a green bar back to the call (like a phone's call pill). */}
      {inCall && tab === 'verify' && (
        <div className="sticky top-0 z-10 bg-[#15803d] text-white shadow-[0_8px_18px_-12px_rgb(21_128_61/0.9)]">
          <button type="button" onClick={() => setTab('call')}
            className="flex min-h-12 w-full items-center gap-3 px-5 py-2.5 text-left text-base font-semibold focus-visible:-outline-offset-4">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-white live-dot" />
            Return to call with SatyaBank
            <span className="ml-auto font-mono tabular-nums">{formatClock(secs)}</span>
          </button>
          {/* The Verify recorder hears the caller through this phone's mic → needs the speaker. */}
          {!speakerOn && (
            <div className="flex items-center gap-3 border-t border-white/25 px-5 py-2 text-base">
              <span className="min-w-0 flex-1">Speaker is off — the recorder may not hear the caller.</span>
              <button type="button" onClick={() => setSpeakerOn(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-[#14532d]">
                <Volume2 aria-hidden="true" className="h-4 w-4" />Speaker on
              </button>
            </div>
          )}
        </div>
      )}
      <div className="px-5 pb-8 pt-5">
        <div hidden={tab !== 'call'}><CallPage call={call} secs={secs} /></div>
        <div hidden={tab !== 'verify'}><AppPage /></div>
      </div>
    </PhoneFrame>
  )
}
