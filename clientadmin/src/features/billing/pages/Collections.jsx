import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collectionsApi, invoicesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { formatMoney } from '@/features/customers/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { CASE_STATUSES, FOLLOW_UP_CHANNELS, FOLLOW_UP_OUTCOMES, LIVE_CASE_STATUSES } from '@/features/billing/utils.js'

const EMPTY_FOLLOW_UP = { channel: 'call', outcome: 'no_response', notes: '', promised_date: '', promised_amount: '' }

function CasePanel({ orgId, collectionCase, canManage, onChanged }) {
  const [form, setForm] = useState(EMPTY_FOLLOW_UP)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const customerInvoices = useQuery(['invoices', orgId, { client_id: collectionCase.client.id, all: true }], ({ signal }) =>
    invoicesApi.listAll(orgId, { client_id: collectionCase.client.id }, { signal })
  )
  const followUps = useQuery(['collection-follow-ups', orgId, collectionCase.id], ({ signal }) =>
    collectionsApi.followUps(orgId, collectionCase.id, { signal })
  )
  const invoices = (customerInvoices.data ?? []).filter((inv) => collectionCase.invoice_ids.includes(inv.id))
  const history = followUps.data ?? []
  const loadError = customerInvoices.error || followUps.error
  const reload = () => {
    if (customerInvoices.error) customerInvoices.reload()
    if (followUps.error) followUps.reload()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { channel: form.channel, outcome: form.outcome, notes: form.notes.trim() }
      if (form.outcome === 'promised' && form.promised_date) body.promised_date = form.promised_date
      if (form.outcome === 'promised' && form.promised_amount) {
        body.promised_amount = { amount: Number(form.promised_amount), currency: collectionCase.total_overdue.currency }
      }
      await collectionsApi.logFollowUp(orgId, collectionCase.id, body)
      setForm(EMPTY_FOLLOW_UP)
      followUps.reload()
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inline-panel">
      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />
      <div className="grid-2">
        <div>
          <h3>Overdue invoices</h3>
          <table>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ cursor: 'default' }}>
                  <td><Link to={`/invoices/${inv.id}`} className="mono">{inv.invoice_no}</Link></td>
                  <td className="small">due {formatDate(inv.due_date)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(inv.balance_due)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>Follow-ups</h3>
          {history.length === 0 ? (
            <p className="muted small">None yet.</p>
          ) : (
            history.map((f) => (
              <div key={f.id} style={{ marginBottom: 8 }}>
                <span className="chip subtle">{FOLLOW_UP_CHANNELS[f.channel] || f.channel}</span>{' '}
                <strong className="small">{FOLLOW_UP_OUTCOMES[f.outcome] || f.outcome}</strong>{' '}
                <span className="muted small">{formatDate(f.followed_up_at.slice(0, 10))}</span>
                {f.notes && <div className="small">{f.notes}</div>}
              </div>
            ))
          )}
        </div>

        {canManage && (
          <form onSubmit={handleSubmit}>
            <h3>Log a follow-up</h3>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`fu-channel-${collectionCase.id}`}>Channel</label>
                <select id={`fu-channel-${collectionCase.id}`} value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                  {Object.entries(FOLLOW_UP_CHANNELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`fu-outcome-${collectionCase.id}`}>Outcome</label>
                <select id={`fu-outcome-${collectionCase.id}`} value={form.outcome} onChange={(e) => set('outcome', e.target.value)}>
                  {Object.entries(FOLLOW_UP_OUTCOMES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.outcome === 'promised' && (
              <div className="grid-2">
                <div className="field">
                  <label htmlFor={`fu-date-${collectionCase.id}`}>Promised by</label>
                  <input
                    id={`fu-date-${collectionCase.id}`}
                    type="date"
                    value={form.promised_date}
                    onChange={(e) => set('promised_date', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`fu-amount-${collectionCase.id}`}>Amount promised</label>
                  <input
                    id={`fu-amount-${collectionCase.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.promised_amount}
                    onChange={(e) => set('promised_amount', e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor={`fu-notes-${collectionCase.id}`}>Notes *</label>
              <textarea
                id={`fu-notes-${collectionCase.id}`}
                required
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log follow-up'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

// Customers owing overdue money, one case each, and the chasing done on them.
export default function Collections() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { ownerName } = useOwners(orgId)
  const canManage = hasAccess(me, ACCESS.manageCollections)
  const [status, setStatus] = useState('live')
  const [openId, setOpenId] = useState(null)
  const [running, setRunning] = useState(false) // the "Refresh overdue" job
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  const casesQuery = useQuery(
    ['collection-cases', orgId, { status }],
    ({ signal }) => collectionsApi.list(orgId, { limit: 100, status: status === 'live' ? '' : status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const { loading, refreshing, reload } = casesQuery
  const all = casesQuery.data?.data ?? []
  const cases = status === 'live' ? all.filter((c) => LIVE_CASE_STATUSES.includes(c.status)) : all

  async function refresh() {
    setError(null)
    setRunning(true)
    try {
      setSummary(await collectionsApi.refresh(orgId))
      invalidate(['collection-cases', orgId])
      invalidate(['invoices', orgId]) // some were just marked overdue
    } catch (err) {
      setError(err)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Collections</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Overdue money in {activeOrg ? `“${activeOrg.name}”` : 'this company'}. Refresh to mark invoices past their due
            date as overdue and open a case for each customer who owes.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setOpenId(null)} />
          {canManage && (
            <button className="btn" onClick={refresh} disabled={running} aria-busy={running}>{running ? 'Refreshing…' : 'Refresh overdue'}</button>
          )}
        </div>
      </div>

      {summary && (
        <div className="alert info">
          {summary.invoices_marked_overdue} invoice(s) newly overdue · {summary.cases_opened} case(s) opened ·{' '}
          {summary.cases_updated} updated · {summary.cases_resolved} resolved.
        </div>
      )}

      <div className="version-tabs">
        {['live', ...CASE_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            className={`version-tab${status === s ? ' active' : ''}`}
            onClick={() => {
              setOpenId(null)
              setStatus(s)
            }}
          >
            {s === 'live' ? 'Being chased' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <ErrorBanner error={error || casesQuery.error} onRetry={error ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th style={{ textAlign: 'right' }}>Overdue</th>
              <th>Invoices</th>
              <th>Level</th>
              <th>Promised</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : cases.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No cases. {canManage && 'Refresh to pick up newly overdue invoices.'}</td></tr>
            ) : (
              cases.map((c) => (
                <CaseRows
                  key={c.id}
                  orgId={orgId}
                  collectionCase={c}
                  open={openId === c.id}
                  toggle={() => setOpenId(openId === c.id ? null : c.id)}
                  ownerName={ownerName}
                  canManage={canManage}
                  onChanged={reload}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CaseRows({ orgId, collectionCase: c, open, toggle, ownerName, canManage, onChanged }) {
  return (
    <>
      <tr onClick={toggle}>
        <td style={{ fontWeight: 600 }}>{c.client.name}</td>
        <td style={{ textAlign: 'right' }}>{formatMoney(c.total_overdue)}</td>
        <td>{c.invoice_ids.length}</td>
        <td>{c.dunning_level}</td>
        <td className="small">
          {c.promised_date ? formatDate(c.promised_date) : <span className="muted">—</span>}
          {c.promised_amount && <div className="muted">{formatMoney(c.promised_amount)}</div>}
        </td>
        <td>{ownerName(c.owner.id) || <span className="muted">—</span>}</td>
        <td><StatusBadge status={c.status} /></td>
      </tr>
      {open && (
        <tr style={{ cursor: 'default' }}>
          <td colSpan={7}>
            <CasePanel orgId={orgId} collectionCase={c} canManage={canManage} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  )
}
