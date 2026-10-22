import { api } from '@/shared/api/http.js'
import { IDENTITY } from '@/shared/api/paths.js'
import { inOrg, pageQuery } from '@/shared/api/query.js'

// ---------- Security audit log (identity.audit_log.read) ----------
export const auditLogApi = {
  // opts: limit, cursor, user_id, event_type, exclude_event_type, status, created_after, created_before
  list: (orgId, opts, { signal } = {}) => api.get(`${IDENTITY}/audit-logs?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
}
