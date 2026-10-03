import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend has no CORS middleware, so during dev we proxy same-origin
// `/api/*` calls to it. Same-origin also matters for the session: the Identity
// service sets the refresh-token cookie on the login response, and the browser
// only keeps it (and sends it back on refresh) because the call looks
// same-origin. Runs on :5180, clear of superadmin (:5173) and the ports Vite
// auto-picks when 5173 is taken (5174, 5175, …).
// Override with API_URL, e.g. API_URL=http://localhost:8000 to go via the gateway.
const API_URL = process.env.API_URL || 'http://localhost:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
