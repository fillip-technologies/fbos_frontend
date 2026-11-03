import { api } from '@/shared/api/http.js'
import { DELIVERY, REVENUE } from '@/shared/api/paths.js'
import { inOrg } from '@/shared/api/query.js'

// The revenue path each record's journey hangs off.
const RECORD_PATHS = {
  lead: 'leads',
  opportunity: 'opportunities',
  quotation: 'quotations',
  contract: 'contracts',
  invoice: 'invoices',
}

const list = (orgId, path, { signal } = {}) => api.get(path, { headers: inOrg(orgId), signal })

export const journeyApi = {
  // One sale from lead to payment, read from any record on it. Stages the caller may not read
  // come back empty and are named in `hidden`.
  // { subject_type, subject_id, client, lead, opportunity, quotations[], contracts[], invoices[], payments[], totals, hidden[] }
  get: (orgId, subject, id, { signal } = {}) =>
    api.get(`${REVENUE}/${RECORD_PATHS[subject]}/${id}/journey`, { headers: inOrg(orgId), signal }),
  // One customer's records in each place they are kept: a few of each, for the customer's page.
  customerRecords: {
    opportunities: (orgId, clientId, opts) => list(orgId, `${REVENUE}/opportunities?client_id=${clientId}&limit=5`, opts),
    contracts: (orgId, clientId, opts) => list(orgId, `${REVENUE}/contracts?client_id=${clientId}&limit=5`, opts),
    projects: (orgId, clientId, opts) => list(orgId, `${DELIVERY}/work-units?client_id=${clientId}&limit=5`, opts),
    invoices: (orgId, clientId, opts) => list(orgId, `${REVENUE}/invoices?client_id=${clientId}&limit=5`, opts),
    payments: (orgId, clientId, opts) => list(orgId, `${REVENUE}/payments?client_id=${clientId}&limit=5`, opts),
  },
  // Delivery's projects for a contract (delivery stores Revenue's contract id).
  projects: (orgId, contractId, { signal } = {}) =>
    api.get(`${DELIVERY}/work-units?contract_id=${contractId}&limit=10`, { headers: inOrg(orgId), signal }),
}
