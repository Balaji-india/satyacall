// ringtone.js — call sounds made with the Web Audio API (no audio files, works offline).
//   startRingtone() — RECEIVER: a mobile-style incoming-call ringtone — a bright rising chime
//                     (marimba-like notes that ring out), played twice, then a pause; repeats
//                     every 3 s. Gain ~0.15. Clearly different from the caller's tone.
//   startRingback() — what the CALLER hears while waiting: 400 Hz, 1 s on · 2 s off. Gain ~0.08.
//   stopAll()       — stops whatever is playing at once; safe to call any number of times.
// Every note fades in (and ringback fades out) over 15 ms, so there are no clicks.
//
// These sounds go to the speakers only (AudioContext.destination). They are never mixed into any
// MediaStream: call audio, clip / Say-It-Back recorders (remote stream) and the Verify recorder
// (its own getUserMedia) are separate. Ringing also stops before the call connects.
import { useEffect, useState } from 'react'

const FADE = 0.015 // seconds
// Ringtone: E5 G#5 B5 E6 rising chime, twice (0 s and 0.8 s), then quiet until 3 s.
const CHIME = [659.25, 830.61, 987.77, 1318.51]
const RING_NOTES = [0, 0.8].flatMap((start) => CHIME.map((f, i) => [start + i * 0.14, f]))
const RING_GAIN = 0.15
const RING_PERIOD = 3.0
// Ringback: one steady 400 Hz burst per period.
const RINGBACK = { freq: 400, gain: 0.08, period: 3.0, dur: 1.0 }
const NO_ANSWER_MS = 45000 // give up ringing after 45 s (sound only — the call itself is untouched)

let ctx = null     // ONE shared AudioContext for the page
let session = null // what is playing now: { out, nodes, timer }

function getCtx() {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try { ctx = new AC() } catch { ctx = null }
  return ctx
}

// Browsers keep audio blocked until the user interacts. The first tap / click / key anywhere
// (Sign in, Go online, Call…) creates + resumes the context; later taps resume it if the browser
// suspended it again (e.g. iPhone after an interruption).
function unlock() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}
if (typeof document !== 'undefined') {
  for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, unlock, { capture: true, passive: true })
}

// One oscillator through its own envelope into the session's output.
// shape(gainParam, at) draws the envelope; the oscillator runs from `at` to `at + dur`.
function tone(s, freq, at, dur, shape) {
  const env = ctx.createGain()
  shape(env.gain, at)
  env.connect(s.out)
  const osc = ctx.createOscillator()
  osc.frequency.value = freq
  osc.connect(env)
  s.nodes.add(osc)
  osc.onended = () => { s.nodes.delete(osc); osc.disconnect(); env.disconnect() }
  osc.start(at)
  osc.stop(at + dur)
}

// Ringtone note: quick attack, then rings out (exponential decay) like a struck bar.
// A soft octave partial on top gives it the bright "phone chime" colour.
function chimeNote(s, freq, at) {
  const ring = (peak, decay) => (g, t) => {
    g.setValueAtTime(0, t)
    g.linearRampToValueAtTime(peak, t + FADE)
    g.exponentialRampToValueAtTime(0.0001, t + decay)
  }
  tone(s, freq, at, 0.6, ring(0.8, 0.55))
  tone(s, freq * 2, at, 0.3, ring(0.2, 0.25))
}

// Ringback burst: steady tone with soft edges.
function steady(s, freq, at, dur) {
  tone(s, freq, at, dur, (g, t) => {
    g.setValueAtTime(0, t)
    g.linearRampToValueAtTime(1, t + FADE)
    g.setValueAtTime(1, t + dur - FADE)
    g.linearRampToValueAtTime(0, t + dur)
  })
}

// Play a repeating pattern: cycle(s, startTime) schedules one period's notes. Notes are
// scheduled on the audio clock about one period ahead (a timer tops it up every 0.5 s), so
// timing stays exact even if the page is busy.
function play(gain, period, cycle) {
  stopAll()
  const c = getCtx()
  if (!c) return // no Web Audio in this browser → silent, the call still works
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = c.createGain()
  out.gain.value = gain
  out.connect(c.destination)
  const s = { out, nodes: new Set(), timer: 0 }
  session = s
  let next = c.currentTime + 0.05
  const schedule = () => {
    if (session !== s) return
    while (next < c.currentTime + period) {
      cycle(s, next)
      next += period
    }
    s.timer = setTimeout(schedule, 500)
  }
  schedule()
}

export const startRingtone = () =>
  play(RING_GAIN, RING_PERIOD, (s, t) => RING_NOTES.forEach(([offset, f]) => chimeNote(s, f, t + offset)))
export const startRingback = () =>
  play(RINGBACK.gain, RINGBACK.period, (s, t) => steady(s, RINGBACK.freq, t, RINGBACK.dur))

export function stopAll() {
  const s = session
  session = null
  if (!s) return
  clearTimeout(s.timer)
  const t = ctx.currentTime
  s.out.gain.cancelScheduledValues(t)
  s.out.gain.setValueAtTime(s.out.gain.value, t)
  s.out.gain.linearRampToValueAtTime(0, t + FADE) // quick fade = no click
  s.nodes.forEach((osc) => { try { osc.stop(t + FADE) } catch { /* already stopped */ } })
  setTimeout(() => s.out.disconnect(), 100)
}

// "Ring sound" on/off for this browser tab (default on).
const KEY = 'satyacall.ringSound'
function readSoundOn() {
  try { return sessionStorage.getItem(KEY) !== 'off' } catch { return true }
}

// Plays the right sound for a usePeerCall() object — UI only, no call logic:
//   incoming call ringing             → ringtone
//   our outgoing call not answered yet → ringback
//   anything else (answered, connected, declined, hung up, failed, offline) → silence
// quiet = this window's speaker is muted / silenced → never ring here.
// Returns [soundOn, setSoundOn] for the "Ring sound" toggle.
export function useRingSound(call, quiet) {
  const [soundOn, setSoundOnState] = useState(readSoundOn)
  const setSoundOn = (on) => {
    setSoundOnState(on)
    try { sessionStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* storage blocked: still works for this page */ }
  }

  const mode = call.status !== 'ringing' ? null
    : call.incoming ? 'ring'
    : call.direction === 'outbound' ? 'ringback'
    : null // answered, waiting for the audio to arrive
  const sound = soundOn && !quiet ? mode : null

  useEffect(() => {
    if (!sound) return
    if (sound === 'ring') startRingtone()
    else startRingback()
    const timer = setTimeout(stopAll, NO_ANSWER_MS)
    return () => { clearTimeout(timer); stopAll() } // state change or unmount → silence
  }, [sound])

  return [soundOn, setSoundOn]
}
