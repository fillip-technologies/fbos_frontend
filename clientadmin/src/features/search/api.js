import { api } from '@/shared/api/http.js'
import { DELIVERY, IDENTITY, PEOPLE, REVENUE } from '@/shared/api/paths.js'
import { inOrg } from '@/shared/api/query.js'

const get = (orgId, path, { signal } = {}) => api.get(path, { headers: inOrg(orgId), signal, background: true })
const enc = encodeURIComponent

// Where records live, asked in parallel by the one search box. Each answers only what the person
// may read; the box merges them by kind of record.
export const searchApi = {
  // { data: [{ type, id, title, subtitle, status, amount }], not_searched }
  sales: (orgId, q, opts) => get(orgId, `${REVENUE}/search?q=${enc(q)}&per_type=5`, opts),
  projects: (orgId, q, opts) => get(orgId, `${DELIVERY}/work-units?q=${enc(q)}&limit=5`, opts),
  tasks: (orgId, q, opts) => get(orgId, `${DELIVERY}/tasks?q=${enc(q)}&limit=5`, opts),
  users: (orgId, q, opts) => get(orgId, `${IDENTITY}/users?q=${enc(q)}&limit=5`, opts),
  employees: (orgId, q, opts) => get(orgId, `${PEOPLE}/workers?search=${enc(q)}&limit=5`, opts),
}
