import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Same-origin `/api/*` proxy (the backend ships no CORS). Runs on :5174 so it can
// sit next to the super-admin console (:5173). Override the target with API_URL.
// Revenue (customers, client services) is its own service on :8002; with API_URL pointing
// at the gateway it goes through the gateway too. Override it alone with REVENUE_URL.
const API_URL = process.env.API_URL || 'http://localhost:8001'
const REVENUE_URL = process.env.REVENUE_URL || process.env.API_URL || 'http://localhost:8002'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // React and the router change rarely: keep them in their own long-cached chunk so
        // a deploy only invalidates the app code. Pages are split by App.jsx's lazy routes.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(id)) return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true, // fail instead of silently moving to another port (emailed links assume :5174)
    proxy: {
      // Listed first: the first matching prefix wins.
      '/api/revenue': {
        target: REVENUE_URL,
        changeOrigin: true,
      },
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
