// CallPanel — status line, error, Answer / Mute / Hang up, and the remote audio player.
// Shared by /call and /agent; `call` is the object returned by usePeerCall().
import { useEffect, useRef, useState } from 'react'

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

const DOT = { offline: 'bg-slate-400', connecting: 'bg-amber-400', online: 'bg-green-500 glow-pass',
  ringing: 'bg-amber-500 animate-pulse', 'in-call': 'bg-green-600 glow-pass', ended: 'bg-slate-500' }

// onHangUp (optional): what "Hang up" does. /agent passes one that also ends monitoring.
// big: phone-sized buttons that share the row (customer /call page).
export default function CallPanel({ call, onHangUp = call.hangUp, big = false }) {
  const inCallOrRinging = call.status === 'ringing' || call.status === 'in-call'
  // Speaker mute: silences THIS window's playback only (the <audio> element). The stream itself is
  // untouched, so the agent's clip / Say-It-Back recording keeps getting the customer's voice.
  const [speakerMuted, setSpeakerMuted] = useState(false)
  const btn = big ? 'flex-1 rounded-2xl py-4 text-lg font-semibold' : 'rounded-xl px-4 py-2 font-semibold'
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 break-words font-medium">
        <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${DOT[call.status]}`} />
        {statusText(call)}
      </p>

      {call.status === 'in-call' && call.link && <LinkBadge link={call.link} />}

      {call.error && <p className="break-words rounded bg-red-50 p-2 text-sm text-red-700">{call.error}</p>}

      <div className={`flex gap-2 ${big ? '' : 'flex-wrap'}`}>
        {call.incoming && (
          <button onClick={call.answer} className={`${btn} bg-pass text-white glow-pass`}>Answer</button>
        )}
        <button onClick={call.toggleMute} disabled={call.status === 'offline' || call.status === 'connecting'}
          className={`${btn} border disabled:opacity-40 ${call.muted ? 'bg-warn text-slate-950' : 'bg-white/5'}`}>
          {call.muted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={call.incoming ? call.hangUp : onHangUp} disabled={!inCallOrRinging}
          className={`${btn} bg-stop text-white glow-stop disabled:opacity-40 disabled:shadow-none`}>
          {call.incoming ? 'Decline' : 'Hang up'}
        </button>
      </div>

      <button type="button" onClick={() => setSpeakerMuted((v) => !v)} aria-pressed={speakerMuted}
        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${speakerMuted ? 'bg-warn text-slate-950' : 'bg-white/5'}`}>
        {speakerMuted ? '🔊 Unmute speaker (this window)' : '🔇 Mute speaker (this window)'}
      </button>
      <p className="text-sm text-slate-500">Use earphones. Same laptop for both windows? Mute speaker in one window.</p>

      <RemoteAudio stream={call.remoteStream} muted={speakerMuted} />
    </div>
  )
}

// Network path of the call, from getStats (real values only). relay = audio goes via a TURN server
// on the internet (slow); host / prflx = direct on the local network; srflx = direct via STUN/NAT.
function LinkBadge({ link }) {
  const types = [link.local, link.remote]
  const kind = types.includes('relay') ? 'Relay' : types.includes('srflx') ? 'Direct (via internet NAT)' : 'Direct LAN'
  const rtt = link.rttMs == null ? 'measuring…' : `${link.rttMs} ms`
  const tone = kind === 'Relay' ? 'border-warn/60 bg-warn/15' : 'border-pass/60 bg-green-50'
  return (
    <p className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${tone}`}
      title={`ICE candidates: ${link.local ?? '?'} → ${link.remote ?? '?'} · round trip from getStats`}>
      {kind} · {rtt}
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
