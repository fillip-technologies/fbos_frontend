import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Verticals: the client's own industries, shared by all of its companies ----------
export const verticalsApi = {
  list: (orgId, params) => listAll(`${IDENTITY}/verticals`, orgId, params),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/verticals`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  // { name } and/or { status: 'active' | 'archived' }
  update: (orgId, id, body) => api.patch(`${IDENTITY}/verticals/${id}`, body, { headers: inOrg(orgId) }),
  objectTypes: (orgId) => listAll(`${IDENTITY}/object-types`, orgId),
}

// ---------- Custom fields: per-organization JSON Schemas for a business object type ----------
// A definition is created as a draft (version 1); publishing makes it live and bumps the version.
// Definitions installed by a vertical pack carry source_pack_id; replaced ones become 'retired'.
export const customFieldsApi = {
  list: (orgId, params) => listAll(`${IDENTITY}/field-definitions`, orgId, params),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/field-definitions`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  publish: (orgId, id, version) =>
    api.post(`${IDENTITY}/field-definitions/${id}/publish`, undefined, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
}

// ---------- Vertical packs: designed once per client in versions, installed per company ----------
// Each call returns the whole pack: { ..., versions: [{ version_no, status, revision, content }],
// latest_published_version, draft_version, installation } (installation = this company's).
const pack = (id) => `${IDENTITY}/vertical-packs/${id}`

export const verticalPacksApi = {
  list: (orgId) => listAll(`${IDENTITY}/vertical-packs`, orgId),
  get: (orgId, id) => api.get(pack(id), { headers: inOrg(orgId) }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/vertical-packs`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, body) => api.patch(pack(id), body, { headers: inOrg(orgId) }),
  // Starts the next draft as a copy of the latest version.
  newVersion: (orgId, id) => api.post(`${pack(id)}/versions`, undefined, { headers: inOrg(orgId) }),
  saveDraft: (orgId, id, versionNo, revision, content) =>
    api.put(`${pack(id)}/versions/${versionNo}`, { content }, { headers: inOrg(orgId, { 'If-Match': `"${revision}"` }) }),
  publish: (orgId, id, versionNo, revision) =>
    api.post(`${pack(id)}/versions/${versionNo}/publish`, undefined, { headers: inOrg(orgId, { 'If-Match': `"${revision}"` }) }),
  // What installing this version would change in the company: { installed_version_no, items }.
  preview: (orgId, id, versionNo) => api.get(`${pack(id)}/versions/${versionNo}/preview`, { headers: inOrg(orgId) }),
  // Idempotent: installing the installed version again changes nothing.
  install: (orgId, id, versionNo) => api.put(`${pack(id)}/installation`, { version_no: versionNo }, { headers: inOrg(orgId) }),
}
