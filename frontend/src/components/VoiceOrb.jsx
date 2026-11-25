// VoiceOrb — the brand's 3D "water & gold" orb, used ONLY on "/" and the two sign-in pages.
// three.js lives in OrbScene.jsx, loaded with React.lazy, so it is downloaded only when an orb
// is actually shown. A CSS-only orb (same colours) is shown instead when the visitor prefers
// reduced motion, "Reduce effects" is on, the browser has no WebGL or the screen is narrow —
// and while the 3D scene loads.
// shadow = soft contact shadow under the orb (light pages only); dark = on a deep-ocean page.
import { lazy, Suspense, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useReduceEffects } from '../effects'
import { useMediaQuery } from '../useMediaQuery'

const OrbScene = lazy(() => import('./OrbScene'))

// Can this browser draw WebGL? The test context is released straight away.
function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

export default function VoiceOrb({ className = '', shadow = false, dark = false }) {
  const reducedMotion = useReducedMotion()
  const [effectsReduced] = useReduceEffects()
  const wide = useMediaQuery('(min-width: 768px)')
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false) // 3D canvas created → hide the CSS orb
  const show3d = webgl && wide && !reducedMotion && !effectsReduced

  return (
    <div aria-hidden="true" className={`orb-stage ${className}`}>
      <div className="orb-glow" />
      {/* Soft contact shadow, drawn in CSS: a WebGL shadow plane shows as a grey box on the
          transparent, bloomed canvas. */}
      {shadow && <div className="orb-shadow" />}
      {(!show3d || !ready) && <StaticOrb />}
      {show3d && (
        <div className="absolute inset-0 overflow-hidden">
          <Suspense fallback={null}><OrbScene dark={dark} onReady={() => setReady(true)} /></Suspense>
        </div>
      )}
    </div>
  )
}

function StaticOrb() {
  return (
    <>
      <div className="orb-ring b" />
      <div className="orb-static" />
      <div className="orb-ring" />
    </>
  )
}
