import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Org units: the company → branch → department → team structure ----------
export const orgUnitsApi = {
  // Every unit, active and inactive, for the structure screen.
  listAll: (orgId) => listAll(`${IDENTITY}/org-units`, orgId),
  get: (orgId, id) => api.get(`${IDENTITY}/org-units/${id}`, { headers: inOrg(orgId) }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/org-units`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, version, body) =>
    api.patch(`${IDENTITY}/org-units/${id}`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  move: (orgId, id, version, body) =>
    api.post(`${IDENTITY}/org-units/${id}/move`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
}
