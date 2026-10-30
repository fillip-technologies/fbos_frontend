import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Same-origin `/api/*` proxy (the backend ships no CORS). Runs on :5174 so it can
// sit next to the super-admin console (:5173). Override the target with API_URL.
// Revenue (customers, client services) is its own service on :8002; with API_URL pointing
// at the gateway it goes through the gateway too. Override it alone with REVENUE_URL.
// Communication (in-app notifications) is likewise its own service on :8006 (COMMUNICATION_URL),
// and so is Delivery (projects, tasks, workflows) on :8003 (DELIVERY_URL).
const API_URL = process.env.API_URL || 'http://localhost:8001'
const REVENUE_URL = process.env.REVENUE_URL || process.env.API_URL || 'http://localhost:8002'
// Documents (files attached to quotations, contracts, ...) is its own service on :8005.
const DOCUMENTS_URL = process.env.DOCUMENTS_URL || process.env.API_URL || 'http://localhost:8005'
const COMMUNICATION_URL = process.env.COMMUNICATION_URL || process.env.API_URL || 'http://localhost:8006'
const DELIVERY_URL = process.env.DELIVERY_URL || process.env.API_URL || 'http://localhost:8003'
// Inventory (devices, stock, transfers, service) is the Fixly backend (Node) on :3000.
const INVENTORY_URL = process.env.INVENTORY_URL || process.env.API_URL || 'http://localhost:3000'
// Assets (fixed assets, equipment, licenses, custody, lifecycle) is on :8009.
const ASSETS_URL = process.env.ASSETS_URL || process.env.API_URL || 'http://localhost:8009'
// People (HCM, ATS, employee directory, attendance, leaves, payroll) is on :8010.
const PEOPLE_URL = process.env.PEOPLE_URL || process.env.API_URL || 'http://localhost:8010'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    assetsDir: 'static',
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
      '/api/documents': {
        target: DOCUMENTS_URL,
        changeOrigin: true,
      },
      '/api/communication': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/delivery': {
        target: DELIVERY_URL,
        changeOrigin: true,
      },
      '/api/inventory': {
        target: INVENTORY_URL,
        changeOrigin: true,
      },
      '/api/assets': {
        target: ASSETS_URL,
        changeOrigin: true,
      },
      '/api/people': {
        target: PEOPLE_URL,
        changeOrigin: true,
      },
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
})
