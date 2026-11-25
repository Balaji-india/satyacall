import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// React + Tailwind (v4 plugin). Run `npm run dev -- --host` so the other laptop can open it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
