import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Org units: the branch → department → team structure (the organization is the company) ----------
export const orgUnitsApi = {
  // Every unit, active and inactive, for the structure screen.
  listAll: (orgId, { signal } = {}) => listAll(`${IDENTITY}/org-units`, orgId, {}, { signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${IDENTITY}/org-units/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/org-units`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, version, body) =>
    api.patch(`${IDENTITY}/org-units/${id}`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  move: (orgId, id, version, body) =>
    api.post(`${IDENTITY}/org-units/${id}/move`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  // { own, effective, inherited_from }: a unit with no verticals of its own inherits its parent's.
  verticals: (orgId, id, { signal } = {}) => api.get(`${IDENTITY}/org-units/${id}/verticals`, { headers: inOrg(orgId), signal }),
  // Branches and departments only; [] means "inherit from the parent".
  setVerticals: (orgId, id, verticalIds) =>
    api.put(`${IDENTITY}/org-units/${id}/verticals`, { vertical_ids: verticalIds }, { headers: inOrg(orgId) }),
  // The client's verticals, to name and pick them here.
  verticalOptions: (orgId, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, {}, { signal }),
}
