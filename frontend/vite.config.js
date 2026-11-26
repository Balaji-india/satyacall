import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'

// React + Tailwind (v4 plugin). Run `npm run dev -- --host` so the other laptop / phone can open it.
//
// Phone mode (VITE_USE_PROXY=true in frontend/.env), dev server only:
// - HTTPS with a self-signed certificate (phones only allow the mic / crypto.subtle on https).
// - The browser calls the backend through this same origin: /api and /ws are forwarded to
//   VITE_BACKEND_TARGET, so an https page never calls http:// directly (mixed content is blocked).
// Flag off = plain http + direct VITE_API_URL / VITE_WS_URL, exactly as before.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const phoneMode = command === 'serve' && env.VITE_USE_PROXY === 'true'
  const target = env.VITE_BACKEND_TARGET || 'http://192.168.137.125:8001'

  return {
    plugins: [react(), tailwindcss(), ...(phoneMode ? [basicSsl()] : [])],
    server: phoneMode
      ? {
          proxy: {
            '/api': { target, changeOrigin: true },
            '/ws/': { target, changeOrigin: true, ws: true },
          },
        }
      : {},
  }
})
