import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { funnelPrerender } from './scripts/funnelPrerender'

export default defineConfig({
  plugins: [react(), funnelPrerender()],
  server: {
    port: 5173
  }
})
