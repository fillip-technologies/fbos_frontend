import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'
import { incomeApi, investmentsApi } from '@/features/finance/api.js'
import Detail from '@/features/finance/components/Detail.jsx'
import IncomeTable from '@/features/finance/components/IncomeTable.jsx'
import { IncomeForm, InvestmentForm } from '@/features/finance/components/InvestmentForms.jsx'
import { INVESTMENT_STATUS_BADGE, INVESTMENT_STATUS_LABELS, INVESTMENT_TYPES, money, num } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

export default function InvestmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orgId, orgs } = useActiveOrg()
  const query = useQuery(['finance-investment', orgId, id], ({ signal }) => investmentsApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const income = useQuery(['finance-income', orgId, { investment_id: id }],
    ({ signal }) => incomeApi.list(orgId, { limit: 100, investment_id: id }, { signal }), { enabled: Boolean(orgId) })
  const [dialog, setDialog] = useState(null) // 'edit' | 'income'
  const [error, setError] = useState(null)
  const investment = query.data

  if (query.error && !investment) return <ErrorBanner error={query.error} onRetry={query.reload} />
  if (!investment) return <DetailSkeleton lines={8} />

  const canWrite = hasAccess(user, ACCESS.manageInvestments)
  const cur = investment.currency
  const value = investment.current_value ?? investment.principal
  const gain = num(value) - num(investment.principal)
  const investee = investment.investee_organization_id && (orgs ?? []).find((o) => o.id === investment.investee_organization_id)

  function refresh(next) {
    if (next) query.setData(next)
    else query.reload()
    invalidate(['finance-investments', orgId])
    setDialog(null)
  }

  async function removeIncome(entry) {
    if (!window.confirm('Delete this income entry?')) return
    setError(null)
    try {
      await incomeApi.remove(orgId, entry.id)
      invalidate(['finance-income', orgId])
      refresh()
    } catch (err) {
      setError(err)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this investment? To keep its history, close it instead.')) return
    setError(null)
    try {
      await investmentsApi.remove(orgId, investment.id)
      invalidate(['finance-investments', orgId])
      navigate('/investments')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{investment.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {INVESTMENT_TYPES[investment.investment_type] ?? investment.investment_type}
            {investment.institution && ` · ${investment.institution}`}{' '}
            <StatusBadge status={INVESTMENT_STATUS_BADGE[investment.status]} label={INVESTMENT_STATUS_LABELS[investment.status]} />
          </p>
        </div>
        <div className="row-actions">
          {canWrite && <button className="btn secondary" onClick={() => setDialog('income')}>+ Income</button>}
          {canWrite && <button className="btn secondary" onClick={() => setDialog('edit')}>Edit</button>}
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="panel">
        <div className="details-grid">
          <Detail label="Invested">{money(investment.principal, cur)}</Detail>
          <Detail label="Current value">
            {investment.current_value === null ? <span className="muted">Not recorded (counted at the amount invested)</span>
              : `${money(investment.current_value, cur)}${investment.current_value_on ? ` on ${formatDate(investment.current_value_on)}` : ''}`}
          </Detail>
          <Detail label="Gain or loss">{investment.current_value !== null && <span style={gain < 0 ? { color: 'var(--danger)' } : undefined}>{money(gain, cur)}</span>}</Detail>
          <Detail label="Income so far">{money(investment.income_to_date, cur)}</Detail>
          <Detail label="Invested on">{formatDate(investment.start_date)}</Detail>
          <Detail label="Matures on">{investment.maturity_date && formatDate(investment.maturity_date)}</Detail>
          <Detail label="Expected return">{investment.expected_rate_pct !== null && `${num(investment.expected_rate_pct)}% a year`}</Detail>
          <Detail label="Reference">{investment.reference && <span className="mono">{investment.reference}</span>}</Detail>
          <Detail label="Company invested in">{investee?.name}</Detail>
          <Detail label="Notes">{investment.notes}</Detail>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <h2 style={{ padding: '14px 16px 0', margin: 0, fontSize: 16 }}>Income from this investment</h2>
        <ErrorBanner error={income.error} onRetry={income.reload} />
        <IncomeTable rows={income.data?.data ?? []} loading={income.loading} canWrite={canWrite} onDelete={removeIncome} showInvestment={false} />
      </div>

      <DocumentPanel orgId={orgId} subjectType={DOCUMENT_SUBJECTS.investment} subjectId={investment.id} canAttach={canWrite}
        emptyText="No certificate or statement attached yet." />

      {canWrite && (
        <div className="danger-zone">
          <h3>Delete investment</h3>
          <p className="muted small" style={{ marginTop: 0 }}>Only an investment with no income recorded can be deleted. Otherwise set its status to Closed.</p>
          <button className="btn danger-outline" onClick={remove}>Delete</button>
        </div>
      )}

      {dialog === 'edit' && <InvestmentForm orgId={orgId} investment={investment} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog === 'income' && (
        <IncomeForm orgId={orgId} investmentId={investment.id} onClose={() => setDialog(null)}
          onSaved={() => { invalidate(['finance-income', orgId]); refresh() }} />
      )}
    </div>
  )
}
