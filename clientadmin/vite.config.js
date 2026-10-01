import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Same-origin `/api/*` proxy (the backend ships no CORS). Runs on :5174 so it can
// sit next to the super-admin console (:5173). Override the target with API_URL.
const API_URL = process.env.API_URL || 'http://localhost:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true, // fail instead of silently moving to another port (emailed links assume :5174)
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
