import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Access catalog: permissions, roles (presets), org units ----------
export const accessApi = {
  permissions: (orgId) => listAll(`${IDENTITY}/permissions`, orgId),
  roles: (orgId) => listAll(`${IDENTITY}/roles`, orgId),
  createRole: (orgId, body) =>
    api.post(`${IDENTITY}/roles`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  replaceRolePermissions: (orgId, roleId, version, permissions) =>
    api.put(`${IDENTITY}/roles/${roleId}/permissions`, { permissions }, {
      headers: inOrg(orgId, { 'If-Match': `"${version}"` }),
    }),
  orgUnits: (orgId) => listAll(`${IDENTITY}/org-units`, orgId, { status: 'active' }),
}
