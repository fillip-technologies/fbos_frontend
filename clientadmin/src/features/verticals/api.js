import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Verticals: the client's own industries, shared by all of its companies ----------
export const verticalsApi = {
  list: (orgId, params, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, params, { signal }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/verticals`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  // { name } and/or { status: 'active' | 'archived' }
  update: (orgId, id, body) => api.patch(`${IDENTITY}/verticals/${id}`, body, { headers: inOrg(orgId) }),
}

// ---------- Custom fields: each form's extra fields, kept by Identity ----------
// Stored as field definitions (JSON Schema lists); `customFieldsApi.list` reads them raw.
export const customFieldsApi = {
  list: (orgId, params, { signal } = {}) => listAll(`${IDENTITY}/field-definitions`, orgId, params, { signal }),
}

const formPath = (code) => `${IDENTITY}/field-definitions/forms/${encodeURIComponent(code)}`

export const formFieldsApi = {
  // { object_type, revision, fields: [{ key, label, type, required, options, help, vertical_ids, show_when }], notes }
  get: (orgId, code, { signal } = {}) => api.get(formPath(code), { headers: inOrg(orgId), signal }),
  // Replaces the form's whole list, live at once. `revision` is the one the edit started from:
  // if someone saved in between, the save is refused (PRECONDITION_FAILED).
  save: (orgId, code, revision, fields) =>
    api.put(formPath(code), { fields }, { headers: inOrg(orgId, { 'If-Match': `"${revision}"` }) }),
  // The live lists that apply to one record: its vertical's, else its team's verticals'. With
  // neither, only the fields kept for every vertical.
  forRecord: (orgId, code, { verticalId, unitId } = {}, { signal } = {}) => {
    const scope = verticalId ? { vertical_id: verticalId } : unitId ? { org_unit_id: unitId } : {}
    return listAll(
      `${IDENTITY}/field-definitions`,
      orgId,
      { object_type: code, status: 'published', scoped: 'true', ...scope },
      { signal }
    )
  },
}
