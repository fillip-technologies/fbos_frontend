import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { pageQuery, inOrg, listAll } from '@/shared/api/query.js'

// ---------- Users ----------
export const usersApi = {
  list: (orgId, opts) => api.get(`${IDENTITY}/users?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  get: (orgId, id) => api.get(`${IDENTITY}/users/${id}`, { headers: inOrg(orgId) }),
  invite: (orgId, body) =>
    api.post(`${IDENTITY}/users`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, version, body) =>
    api.patch(`${IDENTITY}/users/${id}`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  deactivate: (orgId, id, version, body) =>
    api.post(`${IDENTITY}/users/${id}/deactivate`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  resendInvitation: (orgId, id) => api.post(`${IDENTITY}/users/${id}/invitations`, undefined, { headers: inOrg(orgId) }),
  permissions: (orgId, id) => api.get(`${IDENTITY}/users/${id}/permissions`, { headers: inOrg(orgId) }),
  replacePermissions: (orgId, id, body) =>
    api.put(`${IDENTITY}/users/${id}/permissions`, body, { headers: inOrg(orgId) }),
  roleAssignments: (orgId, userId) => listAll(`${IDENTITY}/role-assignments`, orgId, { user_id: userId }),
}
