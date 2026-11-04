import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { incomeApi, investmentsApi } from '@/features/finance/api.js'
import IncomeTable from '@/features/finance/components/IncomeTable.jsx'
import { IncomeForm, InvestmentForm } from '@/features/finance/components/InvestmentForms.jsx'
import { INVESTMENT_STATUS_BADGE, INVESTMENT_STATUS_LABELS, INVESTMENT_TYPES, money } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { invalidate, prefetch, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

// Investments (FDs, funds, equity, property) and income outside sales, on two tabs.
export default function Investments() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'income' ? 'income' : 'investments'
  const canWrite = hasAccess(user, ACCESS.manageInvestments)
  const [creating, setCreating] = useState(null) // 'investment' | 'income'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Investments & other income</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>What the company has invested, and income that isn’t from sales: interest, dividends, rent.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {canWrite && <button className="btn secondary" onClick={() => setCreating('income')}>+ Income</button>}
          {canWrite && <button className="btn" onClick={() => setCreating('investment')}>+ Investment</button>}
        </div>
      </div>

      <div className="segmented" role="tablist" style={{ marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={tab === 'investments'} className={tab === 'investments' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
          Investments
        </button>
        <button type="button" role="tab" aria-selected={tab === 'income'} className={tab === 'income' ? 'active' : ''} onClick={() => setParams({ tab: 'income' }, { replace: true })}>
          Other income
        </button>
      </div>

      {tab === 'investments' ? <InvestmentList /> : <IncomeList canWrite={canWrite} />}
      {creating && <CreateDialogs kind={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}

function CreateDialogs({ kind, onClose }) {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const [, setParams] = useSearchParams()
  const active = useQuery(['finance-investments', orgId, { status: 'active', all: true }],
    ({ signal }) => investmentsApi.list(orgId, { limit: 100, status: 'active' }, { signal }), { enabled: Boolean(orgId) && kind === 'income' })
  if (kind === 'investment') {
    return <InvestmentForm orgId={orgId} onClose={onClose} onSaved={(saved) => { invalidate(['finance-investments', orgId]); navigate(`/investments/${saved.id}`) }} />
  }
  return (
    <IncomeForm orgId={orgId} investments={active.data?.data ?? []} onClose={onClose}
      onSaved={() => { invalidate(['finance-income', orgId]); invalidate(['finance-investments', orgId]); setParams({ tab: 'income' }, { replace: true }); onClose() }} />
  )
}

function InvestmentList() {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const [status, setStatus] = useState('active')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const list = useQuery(['finance-investments', orgId, { status, cursor }],
    ({ signal }) => investmentsApi.list(orgId, { limit: 25, cursor, status }, { signal }), { enabled: Boolean(orgId), keepPrevious: true })
  const rows = list.data?.data ?? []
  const next = list.data?.page?.has_more ? list.data.page.next_cursor : null
  const busy = list.loading || list.refreshing
  const warm = (id) => prefetch(['finance-investment', orgId, id], ({ signal }) => investmentsApi.get(orgId, id, { signal }))

  return (
    <>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(undefined); setStack([]) }} aria-label="Status">
          <option value="active">Active</option>
          <option value="matured">Matured</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </select>
      </div>
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className={`panel${list.refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Investment</th><th>Kind</th><th style={{ textAlign: 'right' }}>Invested</th><th style={{ textAlign: 'right' }}>Current value</th><th style={{ textAlign: 'right' }}>Income so far</th><th>Matures</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.loading ? <TableSkeleton cols={7} /> : rows.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No investments here yet.</td></tr>
            ) : (
              rows.map((i) => (
                <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/investments/${i.id}`)} onMouseEnter={() => warm(i.id)}>
                  <td><div style={{ fontWeight: 600 }}>{i.name}</div>{i.institution && <div className="muted small">{i.institution}</div>}</td>
                  <td>{INVESTMENT_TYPES[i.investment_type] ?? i.investment_type}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{money(i.principal, i.currency)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{i.current_value === null ? <span className="muted">—</span> : money(i.current_value, i.currency)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{money(i.income_to_date, i.currency)}</td>
                  <td>{i.maturity_date ? formatDate(i.maturity_date) : <span className="muted">—</span>}</td>
                  <td><StatusBadge status={INVESTMENT_STATUS_BADGE[i.status]} label={INVESTMENT_STATUS_LABELS[i.status]} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager busy={busy} stack={stack} next={next} onPrevious={() => { setCursor(stack[stack.length - 1]); setStack(stack.slice(0, -1)) }}
        onNext={() => { setStack([...stack, cursor]); setCursor(next) }} />
    </>
  )
}

function IncomeList({ canWrite }) {
  const { orgId } = useActiveOrg()
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [error, setError] = useState(null)
  const list = useQuery(['finance-income', orgId, { cursor }],
    ({ signal }) => incomeApi.list(orgId, { limit: 25, cursor }, { signal }), { enabled: Boolean(orgId), keepPrevious: true })
  const next = list.data?.page?.has_more ? list.data.page.next_cursor : null

  async function remove(entry) {
    if (!window.confirm('Delete this income entry?')) return
    setError(null)
    try {
      await incomeApi.remove(orgId, entry.id)
      invalidate(['finance-income', orgId])
      invalidate(['finance-investments', orgId])
    } catch (err) {
      setError(err)
    }
  }

  return (
    <>
      <ErrorBanner error={list.error || error} onRetry={list.error ? list.reload : undefined} />
      <div className={`panel${list.refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <IncomeTable rows={list.data?.data ?? []} loading={list.loading} canWrite={canWrite} onDelete={remove} />
      </div>
      <Pager busy={list.loading || list.refreshing} stack={stack} next={next}
        onPrevious={() => { setCursor(stack[stack.length - 1]); setStack(stack.slice(0, -1)) }}
        onNext={() => { setStack([...stack, cursor]); setCursor(next) }} />
    </>
  )
}

function Pager({ busy, stack, next, onPrevious, onNext }) {
  return (
    <div className="row-actions" style={{ marginTop: 16 }}>
      <button className="btn secondary" disabled={busy || stack.length === 0} onClick={onPrevious}>← Previous</button>
      <button className="btn secondary" disabled={busy || !next} onClick={onNext}>Next →</button>
    </div>
  )
}
