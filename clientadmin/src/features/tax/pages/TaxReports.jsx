import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { taxReportsApi } from '@/features/tax/api.js'
import { TDS_STATUSES, thisMonth } from '@/features/tax/utils.js'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton, TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'

function Stat({ label, value, sub }) {
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// GST follows the invoice, not the payment: this month's GST is owed on what was issued,
// whether or not the customers have paid. The gap is GST paid to the government before it
// was collected.
function GstVsCash({ orgId, currency }) {
  const [period, setPeriod] = useState(thisMonth())
  const { data: report, error, loading, reload } = useQuery(
    ['gst-vs-cash', orgId, period, currency],
    ({ signal }) => taxReportsApi.gstVsCash(orgId, period, { signal }),
    { enabled: Boolean(orgId && period), keepPrevious: true }
  )
  const gap = Number(report?.gap.amount || 0)

  return (
    <div>
      <div className="row-actions" style={{ alignItems: 'end', marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="report-month">Month</label>
          <input id="report-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} />
        </div>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <PanelSkeleton />
      ) : report && (
        <>
          <div className="cards">
            <Stat label="GST on documents issued" value={formatMoney(report.gst_on_documents)} sub={`On ${formatMoney(report.documents_total)} invoiced, net of credit notes`} />
            <Stat label="GST in what customers settled" value={formatMoney(report.gst_in_settlements)} sub={`${formatMoney(report.cash_collected)} cash + ${formatMoney(report.tds_withheld)} TDS`} />
            <Stat
              label={gap > 0 ? 'GST paid before it is collected' : 'GST collected ahead of invoicing'}
              value={formatMoney(report.gap)}
              sub={gap > 0 ? 'Billing in stages keeps this small.' : undefined}
            />
          </div>
          {Number(report.gst_tds_withheld.amount) > 0 && (
            <p className="muted small">GST-TDS withheld by government customers: {formatMoney(report.gst_tds_withheld)}.</p>
          )}
        </>
      )}
    </div>
  )
}

// Income tax customers kept back from their payments. It settled the invoices, but the money
// is owed by the government until it shows in Form 26AS and is claimed.
function TdsReceivables({ orgId, canManage }) {
  const [filters, setFilters] = useState({ status: '', fiscal_year: '' })
  const { data, error, loading, reload, setData } = useQuery(
    ['tds-receivables', orgId, filters],
    ({ signal }) => taxReportsApi.tdsReceivables(orgId, filters, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const { user: me } = useAuth()
  // Rows carry only the customer's id; name them when customers may be read.
  const { data: customers } = useLookup(
    ['customers', orgId, 'all'],
    ({ signal }) => customersApi.listAll(orgId, { signal }).catch(() => []),
    { enabled: Boolean(orgId) && hasAccess(me, ACCESS.customers) }
  )
  const customerName = (id) => customers?.find((c) => c.id === id)?.name || 'Customer'
  const [editing, setEditing] = useState(null) // { id, status, certificate_no }
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const rows = data ?? []
  const total = rows.reduce((sum, row) => sum + Number(row.amount.amount), 0)

  async function save(row) {
    setBusy(true)
    setActionError(null)
    try {
      const saved = await taxReportsApi.updateTdsReceivable(orgId, row, {
        status: editing.status,
        certificate_no: editing.certificate_no.trim() || null,
      })
      setData(rows.map((item) => (item.id === saved.id ? saved : item)))
      setEditing(null)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="row-actions" style={{ alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tds-status">Status</label>
          <select id="tds-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {Object.entries(TDS_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tds-fy">Fiscal year</label>
          <input id="tds-fy" placeholder="e.g. 2026-27" value={filters.fiscal_year} onChange={(e) => setFilters({ ...filters, fiscal_year: e.target.value.trim() })} />
        </div>
      </div>
      <ErrorBanner error={error || actionError} onRetry={error ? reload : undefined} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Section</th>
              <th>Deducted</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canManage ? 6 : 5} rows={5} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No TDS recorded{filters.status || filters.fiscal_year ? ' for these filters' : ''}.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ cursor: 'default' }}>
                  <td>
                    <Link to={`/customers/${row.client_id}`}>{customerName(row.client_id)}</Link>
                    {row.invoice_id && <div className="small"><Link to={`/invoices/${row.invoice_id}`}>Invoice</Link></div>}
                  </td>
                  <td className="small">
                    {row.section_code || <span className="muted">Not given</span>}
                    {row.statute_ref && <div className="muted">{row.statute_ref}</div>}
                  </td>
                  <td className="small">{formatDate(row.deducted_on)}<div className="muted">{row.fiscal_year} Q{row.quarter}</div></td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(row.amount)}</td>
                  <td className="small">
                    {editing?.id === row.id ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <select aria-label="Status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                          {Object.entries(TDS_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <input aria-label="Certificate number" placeholder="Certificate no." value={editing.certificate_no} onChange={(e) => setEditing({ ...editing, certificate_no: e.target.value })} />
                      </div>
                    ) : (
                      <>
                        {TDS_STATUSES[row.status] || row.status}
                        {row.certificate_no && <div className="muted mono">{row.certificate_no}</div>}
                      </>
                    )}
                  </td>
                  {canManage && (
                    <td>
                      {editing?.id === row.id ? (
                        <div className="row-actions">
                          <button className="btn small-btn" disabled={busy} onClick={() => save(row)}>Save</button>
                          <button className="btn secondary small-btn" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button
                          className="btn secondary small-btn"
                          onClick={() => setEditing({ id: row.id, status: row.status, certificate_no: row.certificate_no || '' })}
                        >
                          Update…
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && <p className="muted small" style={{ textAlign: 'right' }}>Total {total.toFixed(2)}</p>}
    </div>
  )
}

export default function TaxReports() {
  const [params, setParams] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const tabs = [
    ...(hasAccess(me, ACCESS.taxSetup) ? [['gst', 'GST vs cash']] : []),
    ...(hasAccess(me, ACCESS.tdsReceivables) ? [['tds', 'TDS withheld']] : []),
  ]
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : tabs[0]?.[0]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tax reports</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>What {activeOrg ? `“${activeOrg.name}”` : 'this company'} owes and is owed in tax.</p>
        </div>
        <OrgSwitcher />
      </div>
      <div className="version-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams({ tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'gst' && <GstVsCash orgId={orgId} currency={activeOrg?.base_currency || 'INR'} />}
      {tab === 'tds' && <TdsReceivables orgId={orgId} canManage={hasAccess(me, ACCESS.manageTdsReceivables)} />}
    </div>
  )
}
