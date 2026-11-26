// PhoneCallScreen — the customer's native-style call screen (B17). Always mounted in /customer:
// it owns the ONE <audio> player for the bank's voice, and shows the full-screen call UI when
// `show` is true (ringing or in a call). Purely UI on top of usePeerCall() — no call logic here.
//
// Audio modes (honest: a web page cannot choose the earpiece, only the volume and, where the
// browser allows, the output device):
//   Speaker ON (default) → volume 1.0. Also what "Verify caller" needs: its recorder listens to
//                          the caller through this phone's mic.
//   Speaker OFF = Private → volume 0.35 + "Hold the phone to your ear or plug in earphones."
//   Output picker        → only if HTMLMediaElement.setSinkId exists AND more than one audio
//                          output is listed (earphones, Bluetooth…). Otherwise hidden.
// The call mic keeps echoCancellation / noiseSuppression / autoGainControl ON (usePeerCall).
// Extras: vibrate while an incoming call rings (if supported), screen wake lock during the call.
import { useEffect, useRef, useState } from 'react'
import { Ear, Lock, Mic, MicOff, Phone, PhoneOff, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import { LogoMark } from './Icons'
import { LinkBadge } from './CallPanel'
import { formatClock } from '../useCallClock'
import { useMediaQuery } from '../useMediaQuery'

const PRIVATE_VOLUME = 0.35
const RING_PATTERN = [700, 300, 700, 1800] // buzz-buzz … pause; repeated every 3.5 s
const RING_EVERY_MS = 3500
const CAN_PICK_OUTPUT = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

export default function PhoneCallScreen({ call, show, secs, speakerOn, onSpeaker, onVerify }) {
  const audioRef = useRef(null)
  const live = call.status === 'ringing' || call.status === 'in-call'
  const inCall = call.status === 'in-call'
  const ringingIn = call.status === 'ringing' && call.incoming
  const laptop = useMediaQuery('(min-width: 481px)')
  // Laptop only: silence THIS window (one-laptop demo with both windows on one mic/speaker).
  const [silenced, setSilenced] = useState(false)
  const [outputs, setOutputs] = useState([]) // real audio outputs (no "default" pseudo-entries)
  const [sinkId, setSinkId] = useState('')   // '' = the phone's default output

  // Remote voice → the player. Call ends → stream is null → srcObject = null releases it.
  useEffect(() => { if (audioRef.current) audioRef.current.srcObject = call.remoteStream }, [call.remoteStream])
  // Speaker / Private volume. (iPhone Safari ignores .volume — the hint still applies.)
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = speakerOn ? 1 : PRIVATE_VOLUME
    a.muted = silenced
  }, [speakerOn, silenced])

  // Incoming call: vibrate in a ring pattern. Answer / Decline / hang-up / caller gives up →
  // ringingIn turns false → the cleanup stops the buzzing.
  useEffect(() => {
    if (!ringingIn || typeof navigator.vibrate !== 'function') return
    const buzz = () => navigator.vibrate(RING_PATTERN)
    buzz()
    const timer = setInterval(buzz, RING_EVERY_MS)
    return () => { clearInterval(timer); navigator.vibrate(0) }
  }, [ringingIn])

  // Keep the screen on while ringing / in the call. The browser drops the lock when the tab is
  // hidden, so take it again when the page is visible. Released when the call ends.
  useEffect(() => {
    if (!live || !navigator.wakeLock) return
    let lock = null
    let done = false
    const acquire = async () => {
      if (done || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (done) l.release().catch(() => {})
        else lock = l
      } catch { /* not allowed (battery saver, not https) → the screen may dim; the call goes on */ }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [live])

  // Audio outputs, listed while the call screen is up (labels need the mic permission we already
  // have). Plugging earphones / Bluetooth in or out refreshes the list.
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!CAN_PICK_OUTPUT || !live || !md?.enumerateDevices) return
    let stop = false
    const load = () => md.enumerateDevices()
      .then((list) => {
        if (!stop) setOutputs(list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications'))
      })
      .catch(() => {})
    load()
    md.addEventListener('devicechange', load)
    return () => { stop = true; md.removeEventListener('devicechange', load) }
  }, [live])

  const pickOutput = (id) => {
    audioRef.current?.setSinkId(id).then(() => setSinkId(id)).catch(() => setSinkId(''))
  }

  const status = inCall ? 'Connected' : call.incoming ? 'Ringing — incoming call' : 'Calling…'

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />

      {show && (
        <div role="dialog" aria-modal="true" aria-label={call.incoming ? 'Incoming call from SatyaBank' : 'Call with SatyaBank'}
          className="theme-dark call-screen absolute inset-0 z-[15] flex flex-col overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)] pl-[max(env(safe-area-inset-left),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)] pt-[max(env(safe-area-inset-top),1.25rem)] text-center min-[481px]:pt-12">
          {/* Top: what kind of call this is, and the real network path once connected. */}
          <div className="flex min-h-9 flex-wrap items-center justify-center gap-2">
            <p className="inline-flex items-center gap-1.5 text-base text-white/85">
              <Lock aria-hidden="true" className="h-4 w-4 text-accent" />
              {call.incoming ? 'SatyaBank is calling you' : 'SatyaBank app call'}
            </p>
            {inCall && call.link && <LinkBadge link={call.link} />}
          </div>

          {/* Middle: avatar, name, status + timer. */}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
            <span className={`grid h-32 w-32 place-items-center rounded-full bg-[conic-gradient(from_200deg,#d4af6a,#f3e2bd,#d4af6a,#b8914a,#d4af6a)] p-[3px] ${live ? 'gold-pulse' : ''}`}>
              <span className="grid h-full w-full place-items-center rounded-full bg-deep p-[3px]">
                <LogoMark className="h-full w-full rounded-full!" />
              </span>
            </span>
            <div>
              <p className="font-display text-[34px] font-bold leading-tight text-fg">SatyaBank</p>
              <p className="text-lg text-muted">Customer care</p>
            </div>
            <p aria-live="polite" className="text-lg font-medium text-fg">
              <span className={inCall ? '' : 'ringing'}>{status}</span>
              {inCall && <span className="font-mono tabular-nums"> · {formatClock(secs)}</span>}
            </p>
          </div>

          {call.error && (
            <p role="alert" className="mb-4 break-words rounded-2xl border border-stop/40 bg-stop/10 p-3 text-base text-stop-fg">{call.error}</p>
          )}

          {ringingIn ? (
            // Incoming: Decline left, Answer right (like a phone).
            <div className="flex items-start justify-around pb-2">
              <RoundButton label="Decline" onClick={call.hangUp} size="lg" className="bg-[#dc2626] text-white shadow-[0_12px_28px_-10px_rgb(220_38_38/0.8)]">
                <PhoneOff className="h-9 w-9" />
              </RoundButton>
              <RoundButton label="Answer" onClick={call.answer} size="lg" className="answer-ring bg-[#16a34a] text-white">
                <Phone className="h-9 w-9" />
              </RoundButton>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 justify-items-center gap-2">
                <RoundButton label={call.muted ? 'Unmute' : 'Mute'} onClick={call.toggleMute} pressed={call.muted}
                  className={call.muted ? 'bg-white text-deep' : 'bg-white/12 text-white ring-1 ring-white/20'}>
                  {call.muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </RoundButton>
                <RoundButton label={speakerOn ? 'Speaker' : 'Private'} onClick={() => onSpeaker(!speakerOn)} pressed={speakerOn}
                  className={speakerOn ? 'bg-white text-deep' : 'bg-white/12 text-white ring-1 ring-white/20'}>
                  {speakerOn ? <Volume2 className="h-7 w-7" /> : <Ear className="h-7 w-7" />}
                </RoundButton>
                <RoundButton label="Verify caller" onClick={onVerify} disabled={!inCall}
                  className="bg-white/12 text-accent ring-1 ring-gold/50">
                  <ShieldCheck className="h-7 w-7" />
                </RoundButton>
              </div>

              {!speakerOn && (
                <p className="mx-auto inline-flex max-w-xs items-start gap-2 text-left text-base text-muted">
                  <Ear aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  Hold the phone to your ear or plug in earphones.
                </p>
              )}

              {CAN_PICK_OUTPUT && outputs.length > 1 && (
                <label className="mx-auto flex max-w-xs items-center gap-2 text-left text-base text-muted">
                  <span className="shrink-0">Sound to</span>
                  <select value={sinkId} onChange={(e) => pickOutput(e.target.value)}
                    className="field min-w-0 flex-1 py-2 text-base">
                    <option value="">Phone default</option>
                    {outputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Audio output ${i + 1}`}</option>)}
                  </select>
                </label>
              )}

              <div className="flex justify-center">
                <RoundButton label="Hang up" onClick={call.hangUp} size="lg" className="bg-[#dc2626] text-white shadow-[0_12px_28px_-10px_rgb(220_38_38/0.8)]">
                  <PhoneOff className="h-9 w-9" />
                </RoundButton>
              </div>

              {laptop && (
                <button type="button" onClick={() => setSilenced((v) => !v)} aria-pressed={silenced}
                  title="Both windows on one laptop? Silence one, or you hear yourself."
                  className="mx-auto inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-base text-muted underline-offset-4 hover:text-fg hover:underline">
                  {silenced ? <VolumeX aria-hidden="true" className="h-4 w-4" /> : <Volume2 aria-hidden="true" className="h-4 w-4" />}
                  {silenced ? 'Window silenced — unmute' : 'Silence this window'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function RoundButton({ label, onClick, disabled, pressed, size = 'md', className, children }) {
  const circle = size === 'lg' ? 'h-20 w-20' : 'h-[72px] w-[72px]'
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed}
      className="group flex w-24 flex-col items-center gap-2 text-base font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-40">
      <span aria-hidden="true" className={`grid place-items-center rounded-full transition-transform group-enabled:group-active:scale-95 ${circle} ${className}`}>
        {children}
      </span>
      {label}
    </button>
  )
}
