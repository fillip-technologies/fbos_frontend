import { api } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, pageQuery } from '@/shared/api/query.js'

// ---------- Sign-in sessions (one per browser or device) ----------
export const sessionsApi = {
  // The signed-in user's own sessions; `current` marks this browser.
  listMine: () => api.get(`${IDENTITY}/auth/sessions?${pageQuery({ limit: 100 })}`),
  revokeMine: (sessionId) => api.del(`${IDENTITY}/auth/sessions/${sessionId}`),
  // Every other session of the signed-in user; this browser stays signed in.
  revokeMyOthers: () => api.del(`${IDENTITY}/auth/sessions`),

  // Another user's sessions (identity.session.read / identity.session.revoke).
  listForUser: (orgId, userId) =>
    api.get(`${IDENTITY}/users/${userId}/sessions?${pageQuery({ limit: 100 })}`, { headers: inOrg(orgId) }),
  revokeForUser: (orgId, userId, sessionId) =>
    api.del(`${IDENTITY}/users/${userId}/sessions/${sessionId}`, { headers: inOrg(orgId) }),
  revokeAllForUser: (orgId, userId) => api.del(`${IDENTITY}/users/${userId}/sessions`, { headers: inOrg(orgId) }),
}
