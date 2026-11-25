// CallPanel — status line, error, Answer / Mute / Hang up, and the remote audio player.
// Shared by /call and /agent; `call` is the object returned by usePeerCall().
import { useEffect, useRef } from 'react'

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
  const btn = big ? 'flex-1 rounded-2xl py-4 text-lg font-semibold' : 'rounded-xl px-4 py-2 font-semibold'
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 break-words font-medium">
        <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${DOT[call.status]}`} />
        {statusText(call)}
      </p>

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

      <RemoteAudio stream={call.remoteStream} />
    </div>
  )
}

// Plays the OTHER side's voice. srcObject can't be set as a JSX prop, so we set it in an effect.
function RemoteAudio({ stream }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  return <audio ref={ref} autoPlay />
}
