import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { pageQuery } from '@/shared/api/query.js'

// ---------- Organizations (client-admin only; always scoped to the caller's client) ----------
export const organizationsApi = {
  list: (opts, { signal } = {}) => api.get(`${IDENTITY}/organizations?${pageQuery(opts)}`, { signal }),
  get: (id, { signal } = {}) => api.get(`${IDENTITY}/organizations/${id}`, { signal }),
  create: (body) =>
    api.post(`${IDENTITY}/organizations`, body, { headers: { 'Idempotency-Key': uuidv4() } }),
  update: (id, body) => api.patch(`${IDENTITY}/organizations/${id}`, body),
}
