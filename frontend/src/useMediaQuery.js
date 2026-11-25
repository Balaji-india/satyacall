// useMediaQuery — true while a CSS media query matches (e.g. a wide screen). Used to mount the
// 3D orb only where it is visible, so narrow screens never download three.js.
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
