// Entry point: BrowserRouter enables the /call, /agent, /app, /enroll routes.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import CyberBackground from './components/CyberBackground.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CyberBackground />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
