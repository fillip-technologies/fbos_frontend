import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { journeyApi } from '@/features/journey/api.js'
import { formatMoney } from '@/features/journey/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// Each kind of record a customer has: who may see it, how to name a row, where it opens, what to start.
const KINDS = [
  {
    key: 'opportunities',
    label: 'Opportunities',
    read: ACCESS.opportunities,
    row: (o) => ({ to: `/opportunities/${o.id}`, title: o.name, status: o.stage, amount: o.expected_value }),
    start: (c) => ({ label: 'New opportunity', to: `/opportunities/new?customer=${c.id}`, rule: ACCESS.manageOpportunities }),
  },
  {
    key: 'contracts',
    label: 'Contracts',
    read: ACCESS.contracts,
    row: (k) => ({ to: `/contracts/${k.id}`, title: k.contract_no, status: k.status, amount: k.total_value }),
  },
  {
    key: 'projects',
    label: 'Projects',
    read: ACCESS.projects,
    row: (p) => ({ to: `/projects/${p.id}`, title: p.name, status: p.status }),
    start: (c) => ({ label: 'New project', to: `/projects/new?customer=${c.id}`, rule: ACCESS.manageProjects }),
  },
  {
    key: 'invoices',
    label: 'Invoices',
    read: ACCESS.invoices,
    row: (i) => ({ to: `/invoices/${i.id}`, title: i.invoice_no || 'Draft', status: i.status, amount: i.status === 'paid' ? i.totals?.grand_total : i.balance_due }),
    start: (c) => ({ label: 'New invoice', to: `/invoices/new?customer=${c.id}`, rule: ACCESS.manageInvoices }),
  },
  {
    key: 'payments',
    label: 'Payments',
    read: ACCESS.payments,
    row: (p) => ({ to: `/payments/${p.id}`, title: p.code, status: p.status, amount: p.amount }),
    start: (c) => ({ label: 'Record payment', to: `/payments/new?customer=${c.id}`, rule: ACCESS.recordPayments }),
  },
]

function KindCard({ kind, customer, orgId }) {
  const { user: me } = useAuth()
  const { data, error, loading } = useQuery(
    ['customer-records', orgId, customer.id, kind.key],
    (o) => journeyApi.customerRecords[kind.key](orgId, customer.id, o),
    { enabled: Boolean(orgId) },
  )
  const rows = (data?.data ?? []).map(kind.row)
  const start = kind.start?.(customer)
  return (
    <article className="cust-kind">
      <header>
        <h3>
          {kind.label}
          {data && <span className="muted"> {rows.length}{data.page?.has_more ? '+' : ''}</span>}
        </h3>
        {start && hasAccess(me, start.rule) && customer.status !== 'inactive' && (
          <Link className="cust-kind-start" to={start.to}>+ {start.label}</Link>
        )}
      </header>
      {loading && <p className="muted small">Loading…</p>}
      {error && <p className="muted small">Couldn’t be loaded just now.</p>}
      {data && rows.length === 0 && <p className="muted small">None yet.</p>}
      {rows.length > 0 && (
        <ul>
          {rows.map((r) => (
            <li key={r.to}>
              <Link to={r.to}>{r.title}</Link>
              <span className="cust-kind-meta">
                {r.amount && <span className="mono">{formatMoney(r.amount)}</span>}
                <StatusBadge status={r.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/**
 * Everything with one customer, wherever it is kept: deals, contracts, projects, invoices and
 * payments, a few of each with a way to start the next one. Kinds the person may not read are left out.
 */
export default function CustomerRecords({ customer }) {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const kinds = KINDS.filter((k) => hasAccess(me, k.read))
  if (!kinds.length) return null
  return (
    <section className="panel cust-records" aria-label={`Everything with ${customer.name}`}>
      <h2>Everything with {customer.name}</h2>
      <div className="cust-kinds">
        {kinds.map((kind) => (
          <KindCard key={kind.key} kind={kind} customer={customer} orgId={orgId} />
        ))}
      </div>
    </section>
  )
}
