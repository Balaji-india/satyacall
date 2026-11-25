// Entry point: BrowserRouter enables the routes; MotionConfig makes every motion animation
// respect the OS "reduce motion" setting. The 3D voice orb (VoiceOrb, "/" + sign-in only) and each
// device's toasts (sonner) live in that device's layout, so the customer phone stays plain.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
// Self-hosted fonts (bundled by Vite, no Google Fonts request): Inter = body,
// Plus Jakarta Sans = headings, JetBrains Mono = scores / IDs.
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
