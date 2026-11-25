// effects.js — "calm mode": turn the decoration off so the live call and recording get the CPU.
// Calm = (a call / recording is active) OR (the user ticked "Reduce effects").
// While calm, <body> has class "calm": index.css pauses the CyberBackground animations and drops
// backdrop-filter blur, and TrustTimeline turns off Recharts bar animation.
// Purely visual — never touches audio, recording or requests.
import { useEffect, useSyncExternalStore } from 'react'

const KEY = 'satyacall-reduce-effects'
let holds = 0                    // how many active calls / recordings want calm right now
let pinned = readPinned()        // the "Reduce effects" toggle (kept for this browser tab)
const listeners = new Set()

function readPinned() {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}

function apply() {
  if (typeof document !== 'undefined') document.body.classList.toggle('calm', pinned || holds > 0)
  listeners.forEach((l) => l())
}
apply()

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

// Calm while `active` is true (e.g. call ringing / in call, mic recording). Off again when false.
export function useCalmWhile(active) {
  useEffect(() => {
    if (!active) return
    holds++
    apply()
    return () => { holds--; apply() }
  }, [active])
}

// true while calm mode is on (for Recharts isAnimationActive).
export function useCalm() {
  return useSyncExternalStore(subscribe, () => pinned || holds > 0)
}

// [on, toggle] for the "Reduce effects" header switch.
export function useReduceEffects() {
  const on = useSyncExternalStore(subscribe, () => pinned)
  const toggle = () => {
    pinned = !pinned
    try { sessionStorage.setItem(KEY, pinned ? '1' : '0') } catch { /* storage blocked: still works for this page */ }
    apply()
  }
  return [on, toggle]
}
