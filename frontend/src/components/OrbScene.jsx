// OrbScene — the 3D "water & gold" orb (three.js via @react-three/fiber + drei + postprocessing).
// Pure decoration, no data. Loaded lazily by VoiceOrb.jsx, so only "/" and the two sign-in pages
// ever download it; the call pages (/customer, /agent) never do.
// A clear glass sphere around a slowly rippling ocean-blue core, thin gold rings orbiting at
// different tilts, a few slow gold sparkles, a gentle bob, a very soft bloom on the gold glints.
// The orb eases a little toward the pointer. Stops drawing while the tab is hidden.
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Environment, Float, Lightformer, MeshDistortMaterial, MeshTransmissionMaterial, Sparkles,
} from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { easing } from 'maath'
import { Color } from 'three'

const GOLD = '#d4af6a'

function Orb({ backdrop }) {
  const group = useRef(null)
  // Ease the whole orb a little toward the pointer (rotation only, slow damping).
  useFrame((state, dt) => {
    easing.dampE(group.current.rotation, [-state.pointer.y * 0.25, state.pointer.x * 0.35, 0], 0.8, dt)
  })
  return (
    <group ref={group}>
      {/* Clear glass shell with a light-blue tint and a touch of chromatic aberration. */}
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <MeshTransmissionMaterial transmission={1} thickness={0.6} roughness={0.05} ior={1.2}
          chromaticAberration={0.03} anisotropicBlur={0} distortion={0} temporalDistortion={0}
          color="#e6f4fb" envMapIntensity={0.6} background={backdrop} samples={6} resolution={512} backside={false} />
      </mesh>
      {/* Ocean core: a slow ripple, like water. */}
      <mesh scale={0.56}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.3}
          roughness={0.12} metalness={0.15} distort={0.32} speed={1.1} />
      </mesh>
    </group>
  )
}

// [radius, tilt x, tilt y, spin speed]
const RINGS = [[1.36, 1.2, 0.25, 0.12], [1.56, 1.0, -0.5, -0.08], [1.76, 1.45, 0.65, 0.05]]

function Ring({ r, rx, ry, speed }) {
  const ring = useRef(null)
  useFrame((_, dt) => { ring.current.rotation.z += dt * speed })
  return (
    <mesh ref={ring} rotation={[rx, ry, 0]}>
      <torusGeometry args={[r, 0.011, 16, 220]} />
      <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} />
    </mesh>
  )
}

// Studio reflections, built offline (no HDR download): a neutral grey room lit like drei's
// "studio" preset — a big soft overhead panel and a bright top strip, two tall side strips, a
// soft key panel front-left (the highlight on the core) and a dim back fill. Rendered once (frames={1}).
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#4a4d51']} />
      <Lightformer form="rect" intensity={5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 6, 1]} />
      <Lightformer form="rect" intensity={5} position={[0, 4, 3]} scale={[5, 0.6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.5} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[2.5, 7, 1]} />
      <Lightformer form="rect" intensity={2.5} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[2.5, 7, 1]} />
      <Lightformer form="rect" intensity={3} position={[-1.5, 1.5, 5]} scale={[3.2, 2.4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1} position={[0, 1, -6]} scale={[10, 4, 1]} target={[0, 0, 0]} />
    </Environment>
  )
}

// dark = the orb sits on a deep-ocean page (agent sign-in). The glass refracts this colour where
// the page shows through, because a WebGL canvas cannot see the HTML behind it.
export default function OrbScene({ onReady, dark = false }) {
  const [backdrop] = useState(() => new Color(dark ? '#0e2a38' : '#dceff9'))
  // Hidden tab → stop the render loop entirely (no GPU / battery use in the background).
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return (
    <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.5]}
      camera={{ position: [0, 0.2, 5.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' }}
      eventSource={document.getElementById('root')} eventPrefix="client"
      onCreated={() => onReady?.()}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 3]} intensity={1.6} />
      <Studio />

      <Float speed={1} rotationIntensity={0.15} floatIntensity={0.5} floatingRange={[-0.08, 0.08]}>
        <Orb backdrop={backdrop} />
        {RINGS.map(([r, rx, ry, speed]) => <Ring key={r} r={r} rx={rx} ry={ry} speed={speed} />)}
        <Sparkles count={22} scale={[4, 3.4, 2.5]} size={2.6} speed={0.18} opacity={0.85} color={GOLD} />
      </Float>


      {/* Very soft bloom: only the brightest gold glints glow. */}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
      </EffectComposer>
    </Canvas>
  )
}
