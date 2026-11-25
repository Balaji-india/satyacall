// CallPanel — status line, error, Answer / Mute / Hang up, and the remote audio player.
// Shared by the customer phone and /agent; `call` is the object returned by usePeerCall().
// big = phone call screen (avatar, name, status, round buttons); `children` = the phone's main
// action (Go online / Call bank), shown between the status and the round buttons.
import { useEffect, useRef, useState } from 'react'
import { Landmark, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react'

function statusText({ status, myId, otherId, incoming }) {
  switch (status) {
    case 'connecting': return 'connecting…'
    case 'online': return `online as ${myId}`
    case 'ringing': return incoming ? `ringing — incoming call from ${otherId}` : `ringing ${otherId}…`
    case 'in-call': return `in call with ${otherId}`
    case 'ended': return `call ended · online as ${myId}`
    default: return 'offline'
  }
}

const DOT = { offline: 'bg-skip', connecting: 'bg-warn ringing', online: 'bg-sea', ringing: 'bg-warn ringing', 'in-call': 'bg-sea live-dot', ended: 'bg-skip' }

// onHangUp (optional): what "Hang up" does. /agent passes one that also ends monitoring.
export default function CallPanel({ call, onHangUp = call.hangUp, big = false, children }) {
  const inCallOrRinging = call.status === 'ringing' || call.status === 'in-call'
  const noLine = call.status === 'offline' || call.status === 'connecting'
  // Speaker mute: silences THIS window's playback only (the <audio> element). The stream itself is
  // untouched, so the agent's clip / Say-It-Back recording keeps getting the customer's voice.
  const [speakerMuted, setSpeakerMuted] = useState(false)
  const hangUp = call.incoming ? call.hangUp : onHangUp

  const speakerToggle = (
    <button type="button" onClick={() => setSpeakerMuted((v) => !v)} aria-pressed={speakerMuted}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-base font-semibold transition-colors ${speakerMuted ? 'border-warn/60 bg-warn/15 text-warn-fg' : 'border-line bg-inset'}`}>
      {speakerMuted ? <VolumeX aria-hidden="true" className="h-4 w-4" /> : <Volume2 aria-hidden="true" className="h-4 w-4" />}
      {speakerMuted ? 'Speaker muted — unmute' : 'Mute speaker (this window)'}
    </button>
  )
  const errorBox = call.error && (
    <p role="alert" className="break-words rounded-xl border border-stop/40 bg-stop/10 p-3 text-base text-stop-fg">{call.error}</p>
  )

  if (big) {
    return (
      <div className="space-y-5">
        {/* Call screen: who you're calling + live status. */}
        <div className="card flex flex-col items-center gap-3 bg-[image:radial-gradient(90%_60%_at_50%_0%,rgb(2_132_199/0.12),transparent_70%)] px-5 pb-6 pt-7 text-center">
          {/* Avatar with a gold ring; the ring pulses gently while ringing or in a call. */}
          <span className={`grid h-24 w-24 place-items-center rounded-full p-[3px] ${inCallOrRinging ? 'gold-pulse' : ''} bg-[conic-gradient(from_200deg,#d4af6a,#f3e2bd,#d4af6a,#b8914a,#d4af6a)]`}>
            <span className="grid h-full w-full place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#38bdf8,#0284c7_45%,#0b2533)] text-white">
              <Landmark aria-hidden="true" className="h-10 w-10" strokeWidth={1.6} />
            </span>
          </span>
          <div>
            <p className="font-display text-2xl font-bold text-fg">SatyaBank</p>
            <p className="text-base text-muted">Customer care</p>
          </div>
          <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-inset px-3 py-1.5 text-base font-medium">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[call.status]}`} />
            <span className="break-all">{statusText(call)}</span>
          </p>
          {call.status === 'in-call' && call.link && <LinkBadge link={call.link} />}

          {/* Round call buttons with a label under each, like a phone's call screen. */}
          <div className="mt-2 flex items-start justify-center gap-8">
            {call.incoming && (
              <RoundButton label="Answer" onClick={call.answer} className="bg-[#15803d] text-white">
                <Phone className="h-7 w-7" />
              </RoundButton>
            )}
            <RoundButton label={call.muted ? 'Unmute' : 'Mute'} onClick={call.toggleMute} disabled={noLine} pressed={call.muted}
              className={call.muted ? 'bg-deep text-white' : 'border border-line bg-white text-fg shadow-sm'}>
              {call.muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </RoundButton>
            <RoundButton label={call.incoming ? 'Decline' : 'Hang up'} onClick={hangUp} disabled={!inCallOrRinging} className="bg-stop text-white shadow-[0_10px_24px_-10px_rgb(220_38_38/0.7)]">
              <PhoneOff className="h-7 w-7" />
            </RoundButton>
          </div>
        </div>

        {errorBox}
        {children}

        <div className="space-y-2 text-center">
          {speakerToggle}
          <p className="text-base text-muted">Use earphones. Same laptop for both windows? Mute the speaker in one.</p>
        </div>
        <RemoteAudio stream={call.remoteStream} muted={speakerMuted} />
      </div>
    )
  }

  // Agent desk: compact line status + buttons.
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="inline-flex min-w-0 items-center gap-2 rounded-full bg-inset px-3 py-2 text-base font-medium">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[call.status]}`} />
          <span className="break-all">{statusText(call)}</span>
        </p>
        {call.status === 'in-call' && call.link && <LinkBadge link={call.link} />}
        <div className="flex flex-wrap items-center gap-2">
        {call.incoming && (
          <button onClick={call.answer} className="btn-go px-4 py-2.5">
            <Phone aria-hidden="true" className="h-4 w-4" />Answer
          </button>
        )}
        <button onClick={call.toggleMute} disabled={noLine} aria-pressed={call.muted}
          className={`btn-ghost px-4 py-2.5 ${call.muted ? 'border-warn/60 text-warn-fg' : ''}`}>
          {call.muted ? <MicOff aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
          {call.muted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={hangUp} disabled={!inCallOrRinging}
          className="btn-danger px-4 py-2.5">
          <PhoneOff aria-hidden="true" className="h-4 w-4" />{call.incoming ? 'Decline' : 'Hang up'}
        </button>
          {speakerToggle}
        </div>
      </div>
      {errorBox}
      <RemoteAudio stream={call.remoteStream} muted={speakerMuted} />
    </div>
  )
}

function RoundButton({ label, onClick, disabled, pressed, className, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed}
      className="group flex w-20 flex-col items-center gap-2 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40">
      <span aria-hidden="true" className={`grid h-16 w-16 place-items-center rounded-full transition-transform group-enabled:group-active:scale-95 ${className}`}>
        {children}
      </span>
      {label}
    </button>
  )
}

// Network path of the call, from getStats (real values only). relay = audio goes via a TURN server
// on the internet (slow); host / prflx = direct on the local network; srflx = direct via STUN/NAT.
function LinkBadge({ link }) {
  const types = [link.local, link.remote]
  const kind = types.includes('relay') ? 'Relay' : types.includes('srflx') ? 'Direct (via internet NAT)' : 'Direct LAN'
  const rtt = link.rttMs == null ? 'measuring…' : `${link.rttMs} ms`
  const tone = kind === 'Relay' ? 'border-warn/50 bg-warn/12 text-warn-fg' : 'border-pass/45 bg-pass/10 text-pass-fg'
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-base font-semibold ${tone}`}
      title={`ICE candidates: ${link.local ?? '?'} → ${link.remote ?? '?'} · round trip from getStats`}>
      {kind} · <span className="font-mono">{rtt}</span>
    </p>
  )
}

// The ONE player for the OTHER side's voice (never our own mic → no self-monitoring). Plain
// <audio>, no Web Audio in between. srcObject / muted are set in effects (not JSX props).
// Call ends → stream is null → srcObject = null, which releases the player.
function RemoteAudio({ stream, muted }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  useEffect(() => { if (ref.current) ref.current.muted = muted }, [muted])
  return <audio ref={ref} autoPlay playsInline />
}
