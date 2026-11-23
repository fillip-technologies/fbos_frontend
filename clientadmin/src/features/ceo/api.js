import { api } from '@/shared/api/http.js'
import { BFF, DELIVERY, IDENTITY, PEOPLE, REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

// The CEO Command Center is one gateway screen: it reads every company of the client (or only the
// caller's own, for anyone but a client admin) and adds them up. No X-Organization-Id: the gateway
// decides which companies to read from who is signed in.
export const ceoApi = {
  // { from, to } as YYYY-MM-DD; the gateway compares with the same number of days just before.
  screen: ({ from, to }, { signal } = {}) =>
    api.get(`${BFF}/screens/ceo?${new URLSearchParams({ from, to, compare: 'previous_period' })}`, { signal }),
  // The watchlist reads one company at a time, each summary behind its list's read permission.
  invoices: (orgId, months, { signal } = {}) => api.get(`${REVENUE}/invoices/summary?months=${months}`, { headers: inOrg(orgId), signal }),
  payments: (orgId, months, { signal } = {}) => api.get(`${REVENUE}/payments/summary?months=${months}`, { headers: inOrg(orgId), signal }),
  projects: (orgId, { signal } = {}) => api.get(`${DELIVERY}/work-units/stats`, { headers: inOrg(orgId), signal }),
  workforce: (orgId, months, { signal } = {}) => api.get(`${PEOPLE}/workers/summary?months=${months}`, { headers: inOrg(orgId), signal }),
  gstVsCash: (orgId, period, { signal } = {}) =>
    api.get(`${REVENUE}/reports/gst-vs-cash?${new URLSearchParams({ period })}`, { headers: inOrg(orgId), signal }),
  // To name the revenue-by-vertical rows (revenue stores only the id).
  verticals: (orgId, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, {}, { signal }),
}
