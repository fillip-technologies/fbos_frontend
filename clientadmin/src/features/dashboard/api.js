import { api } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'

// ---------- The caller's own client: subscription window + quotas (read-only) ----------
export const clientApi = {
  me: ({ signal } = {}) => api.get(`${IDENTITY}/clients/me`, { signal }),
}
