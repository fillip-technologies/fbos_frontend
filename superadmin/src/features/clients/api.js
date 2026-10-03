import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'

// ---------- Clients endpoints (platform-admin only) ----------
export const clientsApi = {
  list: ({ limit = 25, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return api.get(`${IDENTITY}/clients?${params.toString()}`)
  },

  get: (id) => api.get(`${IDENTITY}/clients/${id}`),

  create: (body) =>
    api.post(`${IDENTITY}/clients`, body, {
      headers: { 'Idempotency-Key': uuidv4() },
    }),

  update: (id, body) => api.patch(`${IDENTITY}/clients/${id}`, body),

  // Permanent: removes the client with its organizations, users and credentials.
  remove: (id) => api.delete(`${IDENTITY}/clients/${id}`),
}
