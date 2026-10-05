import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Working calendars (hours + holidays); org units point at one ----------
// The backend has no endpoint to rename a calendar or change its hours after creation;
// only the holiday list can be replaced.
export const calendarsApi = {
  list: (orgId, { signal } = {}) => listAll(`${IDENTITY}/calendars`, orgId, {}, { signal }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/calendars`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  // Replaces the whole holiday list: [{ date: 'YYYY-MM-DD', name, is_half_day }].
  replaceHolidays: (orgId, id, version, holidays) =>
    api.put(`${IDENTITY}/calendars/${id}/holidays`, { holidays }, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
}
