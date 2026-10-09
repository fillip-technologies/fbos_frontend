import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { allContracts, billingSchedulesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { SCHEDULE_LINE_STATUSES } from '@/features/billing/utils.js'

const TRIGGERS = { advance: 'Advance', milestone: 'Milestone', date: 'On a date', on_completion: 'On completion', monthly: 'Monthly' }

// Each line of a contract's billing schedule is invoiced on its own, when it falls due or its
// milestone is reached, so GST is owed on what is billed now, not on the whole contract.
export default function BillingSchedules() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const contractId = params.get('contract')
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canBill = hasAccess(me, ACCESS.billScheduleLines) && hasAccess(me, ACCESS.manageInvoices)

  const schedules = useQuery(
    ['billing-schedules', orgId, contractId],
    ({ signal }) => billingSchedulesApi.list(orgId, { contract_id: contractId }, { signal }),
    { enabled: Boolean(orgId) }
  )
  const ready = useQuery(
    ['billing-schedule-lines', orgId, 'billable'],
    ({ signal }) => billingSchedulesApi.lines(orgId, { billable: 'true' }, { signal }),
    { enabled: Boolean(orgId) && !contractId }
  )
  const { data: contracts } = useLookup(['contracts', orgId, 'all'], ({ signal }) => allContracts(orgId, { signal }).catch(() => []), {
    enabled: Boolean(orgId) && hasAccess(me, ACCESS.contracts),
  })
  const { data: customers } = useLookup(
    ['customers', orgId, 'all'],
    ({ signal }) => customersApi.listAll(orgId, { signal }).catch(() => []),
    { enabled: Boolean(orgId) && hasAccess(me, ACCESS.customers) }
  )
  const contractNo = (id) => contracts?.find((c) => c.id === id)?.contract_no || 'Contract'
  const customerName = (id) => customers?.find((c) => c.id === id)?.name || 'Customer'
  const scheduleById = Object.fromEntries((schedules.data ?? []).map((schedule) => [schedule.id, schedule]))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = () => {
    invalidate(['billing-schedules', orgId])
    invalidate(['billing-schedule-lines', orgId])
    schedules.reload()
    if (!contractId) ready.reload()
  }

  async function act(change) {
    setBusy(true)
    setError(null)
    try {
      await change()
      refresh()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function bill(scheduleId, line) {
    setBusy(true)
    setError(null)
    try {
      const invoice = await billingSchedulesApi.billLine(orgId, scheduleId, line.id, uuidv4())
      invalidate(['invoices', orgId])
      invalidate(['billing-schedules', orgId])
      invalidate(['billing-schedule-lines', orgId])
      navigate(`/invoices/${invoice.id}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const lineActions = (scheduleId, line) => {
    if (!canBill || ['invoiced', 'cancelled'].includes(line.status)) {
      return line.invoice_id ? <Link className="btn secondary small-btn" to={`/invoices/${line.invoice_id}`}>Invoice</Link> : null
    }
    return (
      <div className="row-actions">
        {line.billable && (
          <button className="btn small-btn" disabled={busy} onClick={() => bill(scheduleId, line)}>Draft invoice</button>
        )}
        {line.status === 'planned' && !line.billable && (
          <button className="btn secondary small-btn" disabled={busy} onClick={() => act(() => billingSchedulesApi.updateLine(orgId, scheduleId, line, { status: 'ready' }))}>
            {line.milestone_type === 'milestone' ? 'Milestone reached' : 'Bill early'}
          </button>
        )}
        {line.status === 'ready' && (
          <button className="btn secondary small-btn" disabled={busy} onClick={() => act(() => billingSchedulesApi.updateLine(orgId, scheduleId, line, { status: 'planned' }))}>
            Not yet
          </button>
        )}
        <button
          className="btn danger-outline small-btn"
          disabled={busy}
          onClick={() => window.confirm('Cancel this line? It won’t be billed.') && act(() => billingSchedulesApi.updateLine(orgId, scheduleId, line, { status: 'cancelled' }))}
        >
          Cancel
        </button>
      </div>
    )
  }

  const describe = (line) => (
    <>
      <div>{line.description || TRIGGERS[line.milestone_type] || line.milestone_type}</div>
      <div className="muted small">
        {TRIGGERS[line.milestone_type] || line.milestone_type}
        {line.milestone_code && ` · ${line.milestone_code}`}
        {line.percent != null && ` · ${line.percent}%`}
      </div>
    </>
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{contractId ? `Billing schedule · ${contractNo(contractId)}` : 'Ready to bill'}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Amounts are before tax; the drafted invoice adds the GST in effect when it is issued.
          </p>
        </div>
        <div className="row-actions">
          {!contractId && <OrgSwitcher />}
          {contractId && <Link className="btn secondary" to={`/contracts/${contractId}`}>← Contract</Link>}
        </div>
      </div>
      <ErrorBanner error={error || schedules.error || ready.error} onRetry={refresh} />

      {contractId ? (
        schedules.loading ? (
          <div className="panel"><table><tbody><TableSkeleton cols={5} rows={4} /></tbody></table></div>
        ) : (schedules.data ?? []).length === 0 ? (
          <div className="panel muted">
            This contract has no billing schedule. A schedule is made when the contract is activated, unless billing is set to manual
            under Tax setup → Billing settings.
          </div>
        ) : (
          schedules.data.map((schedule) => (
            <div key={schedule.id} className="panel" style={{ overflowX: 'auto' }}>
              <p className="muted small" style={{ marginTop: 0 }}>
                {customerName(schedule.client_id)} · contract value before tax {formatMoney(schedule.basis_amount)}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Line</th>
                    <th>Billable from</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {schedule.lines.map((line) => (
                    <tr key={line.id} style={{ cursor: 'default' }}>
                      <td>{line.seq}</td>
                      <td>{describe(line)}</td>
                      <td>{line.due_date ? formatDate(line.due_date) : <span className="muted">When reached</span>}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(line.amount)}</td>
                      <td>
                        <StatusBadge status={line.billable && line.status === 'planned' ? 'ready' : line.status} label={line.billable && line.status === 'planned' ? 'Due' : SCHEDULE_LINE_STATUSES[line.status]} />
                      </td>
                      <td>{lineActions(schedule.id, line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Line</th>
                <th>Billable from</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ready.loading || schedules.loading ? (
                <TableSkeleton cols={5} rows={5} />
              ) : (ready.data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="center-note">Nothing is due to bill. Lines appear here on their date, or when a milestone is marked reached.</td></tr>
              ) : (
                ready.data.map((line) => {
                  const schedule = scheduleById[line.schedule_id]
                  return (
                    <tr key={line.id} style={{ cursor: 'default' }}>
                      <td>
                        {schedule ? (
                          <>
                            <Link to={`/billing-schedules?contract=${schedule.contract_id}`}>{contractNo(schedule.contract_id)}</Link>
                            <div className="muted small">{customerName(schedule.client_id)}</div>
                          </>
                        ) : (
                          'Contract'
                        )}
                      </td>
                      <td>{describe(line)}</td>
                      <td>{line.due_date ? formatDate(line.due_date) : <span className="muted">Milestone reached</span>}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(line.amount)}</td>
                      <td>{lineActions(line.schedule_id, line)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
