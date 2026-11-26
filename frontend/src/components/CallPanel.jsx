// CallPanel — the agent desk's call line: status, error, Answer / Mute / Hang up, and the remote
// audio player. `call` is the object returned by usePeerCall(). (The customer phone has its own
// full-screen call screen: PhoneCallScreen.jsx, which reuses LinkBadge from here.)
import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react'

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
export default function CallPanel({ call, onHangUp = call.hangUp }) {
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

// Network path of the call, from getStats (real values only). relay = audio goes via a TURN server
// on the internet (slow); host / prflx = direct on the local network; srflx = direct via STUN/NAT.
export function LinkBadge({ link }) {
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
