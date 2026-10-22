import { api, uuidv4 } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// ---------- Working calendars (hours + holidays); org units point at one ----------
// The backend has no endpoint to rename a calendar or change its hours after creation;
// only the holidays and extra working days can be replaced.
export const calendarsApi = {
  list: (orgId, { signal } = {}) => listAll(`${IDENTITY}/calendars`, orgId, {}, { signal }),
  create: (orgId, body) =>
    api.post(`${IDENTITY}/calendars`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  // Replaces both lists: holidays [{ date: 'YYYY-MM-DD', name, is_half_day }] and extra working days
  // [{ date, name, hours: [['09:00', '13:00'], ...] }] (days worked with their own hours, e.g. a working Saturday).
  replaceHolidays: (orgId, id, version, holidays, workingDays) =>
    api.put(
      `${IDENTITY}/calendars/${id}/holidays`,
      { holidays, working_days: workingDays },
      { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }
    ),
}
