import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { pageQuery, inOrg, listAll } from '@/shared/api/query.js'

// ---------- Users ----------
export const usersApi = {
  // Filters: status, unit_id (works there or below), team_id (works in the team or is a member), role_code, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${IDENTITY}/users?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${IDENTITY}/users/${id}`, { headers: inOrg(orgId), signal }),
  invite: (orgId, body) =>
    api.post(`${IDENTITY}/users`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, version, body) =>
    api.patch(`${IDENTITY}/users/${id}`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  deactivate: (orgId, id, version, body) =>
    api.post(`${IDENTITY}/users/${id}/deactivate`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  resendInvitation: (orgId, id) => api.post(`${IDENTITY}/users/${id}/invitations`, undefined, { headers: inOrg(orgId) }),
  // Extra team membership; where the person works doesn't change. Both are safe to repeat.
  joinTeam: (orgId, id, teamId) => api.put(`${IDENTITY}/users/${id}/teams/${teamId}`, undefined, { headers: inOrg(orgId) }),
  leaveTeam: (orgId, id, teamId) => api.del(`${IDENTITY}/users/${id}/teams/${teamId}`, { headers: inOrg(orgId) }),
  permissions: (orgId, id, { signal } = {}) => api.get(`${IDENTITY}/users/${id}/permissions`, { headers: inOrg(orgId), signal }),
  replacePermissions: (orgId, id, body) =>
    api.put(`${IDENTITY}/users/${id}/permissions`, body, { headers: inOrg(orgId) }),
  roleAssignments: (orgId, userId) => listAll(`${IDENTITY}/role-assignments`, orgId, { user_id: userId }),
}
