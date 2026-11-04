import { api } from '@/shared/api/http.js'
import { BFF, IDENTITY } from '@/shared/api/paths.js'
import { listAll } from '@/shared/api/query.js'

// The CEO Command Center is one gateway screen: it reads every company of the client (or only the
// caller's own, for anyone but a client admin) and adds them up. No X-Organization-Id: the gateway
// decides which companies to read from who is signed in.
export const ceoApi = {
  // { from, to } as YYYY-MM-DD; the gateway compares with the same number of days just before.
  screen: ({ from, to }, { signal } = {}) =>
    api.get(`${BFF}/screens/ceo?${new URLSearchParams({ from, to, compare: 'previous_period' })}`, { signal }),
  // To name the revenue-by-vertical rows (revenue stores only the id).
  verticals: (orgId, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, {}, { signal }),
}
