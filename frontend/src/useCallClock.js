// useCallClock — seconds since the call connected (for the mm:ss timer on the call screen).
// Starts at 0 each time `active` turns true; when the call ends it keeps the last value, so
// "Call ended · 02:14" can still show how long the call was. Display only.
import { useEffect, useState } from 'react'

export function useCallClock(active) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!active) return
    const t0 = Date.now()
    const tick = () => setSecs(Math.floor((Date.now() - t0) / 1000))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [active])
  return secs
}

// 75 → "01:15"
export const formatClock = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
