import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The backend has no CORS middleware, so during dev we proxy same-origin
// `/api/*` calls to it. This super-admin app only uses the Identity service,
// which serves `/api/identity/v1/*` directly, so we target it straight on :8001
// (the gateway on :8000 is optional and often not running in local dev).
// Override with API_URL, e.g. API_URL=http://localhost:8000 to go via the gateway.
const API_URL = process.env.API_URL || 'http://localhost:8001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true, // fail instead of silently moving to another port (emailed links assume fixed ports)
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
