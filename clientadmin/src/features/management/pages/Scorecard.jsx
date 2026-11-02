import { useEffect, useState } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { CheckInDialog, RagBadge } from '@/features/management/components.jsx'
import { planningApi, scorecardApi } from '@/features/management/api.js'
import { byStart, covering, percent, RAG_LABELS } from '@/features/management/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

// Goals with their KPIs for one period: the computed score next to the owner's own confidence.
// When the two disagree, that disagreement is the thing to look at.
export default function Scorecard() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canCheckIn = hasAccess(user, ACCESS.checkIn)
  const [yearId, setYearId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [checkingIn, setCheckingIn] = useState(null)

  const years = useLookup(['mgmt-years', orgId], ({ signal }) => planningApi.fiscalYears(orgId, { signal }).then(byStart), {
    enabled: Boolean(orgId),
  })
  const periods = useLookup(
    ['mgmt-periods', orgId, yearId],
    ({ signal }) => planningApi.periods(orgId, yearId, { signal }).then(byStart),
    { enabled: Boolean(orgId && yearId) }
  )

  // Open on the year covering today (else the latest), then on its quarter covering today.
  useEffect(() => {
    if (!yearId && years.data?.length) setYearId(covering(years.data, todayIso()).id)
  }, [years.data, yearId])
  useEffect(() => {
    if (!periods.data?.length || periods.data.some((p) => p.id === periodId)) return
    const quarters = periods.data.filter((p) => p.period_type === 'quarter')
    setPeriodId(covering(quarters.length ? quarters : periods.data, todayIso()).id)
  }, [periods.data, periodId])

  const card = useQuery(
    ['mgmt-scorecard', orgId, periodId],
    ({ signal }) => scorecardApi.scorecard(orgId, periodId, { signal }),
    { enabled: Boolean(orgId && periodId) }
  )
  const goals = card.data?.goals ?? []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Scorecard</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            What was achieved against each goal, and how confident its owner is.
          </p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={yearId} onChange={(e) => { setYearId(e.target.value); setPeriodId('') }} aria-label="Fiscal year">
          {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
        </select>
        <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} aria-label="Period">
          {(periods.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({formatDate(p.start_date)} – {formatDate(p.end_date)})</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={card.error || years.error || periods.error} onRetry={card.reload} />

      {!years.loading && !years.data?.length ? (
        <div className="panel center-note">No fiscal year yet. Create one under Planning.</div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Goal</th><th>Owner</th><th>Score</th><th>Computed</th><th>Owner's view</th><th /></tr>
            </thead>
            <tbody>
              {card.loading ? (
                <TableSkeleton cols={6} />
              ) : goals.length === 0 ? (
                <tr><td colSpan={6} className="center-note">No goals in this period.</td></tr>
              ) : (
                goals.map((g) => (
                  <GoalRows key={g.goal_id} goal={g} canCheckIn={canCheckIn} onCheckIn={() => setCheckingIn(g)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {checkingIn && (
        <CheckInDialog
          orgId={orgId}
          goal={checkingIn}
          periodId={periodId}
          onClose={() => setCheckingIn(null)}
          onSaved={() => { setCheckingIn(null); card.reload() }}
        />
      )}
    </div>
  )
}

function KpiStatus({ status }) {
  return RAG_LABELS[status] ? <RagBadge rag={status} /> : <StatusBadge status={status} label={status.replaceAll('_', ' ')} />
}

function GoalRows({ goal, canCheckIn, onCheckIn }) {
  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600 }}>{goal.name}</div>
          <div className="muted small mono">{goal.code}</div>
        </td>
        <td>{goal.owner?.name || 'Unknown'}</td>
        <td>{percent(goal.score_pct)}</td>
        <td><RagBadge rag={goal.computed_rag} /></td>
        <td>
          {goal.check_in ? (
            <>
              <RagBadge rag={goal.check_in.rag} />{' '}
              <span className="muted small">{Math.round(goal.check_in.confidence * 100)}% confident</span>
              {goal.disagreement && <> <StatusBadge status="escalated" label="Disagrees with the score" /></>}
              <div className="muted small">{goal.check_in.narrative}</div>
            </>
          ) : (
            <span className="muted">No check-in yet</span>
          )}
        </td>
        <td>{canCheckIn && <button className="btn secondary small-btn" onClick={onCheckIn}>Check in</button>}</td>
      </tr>
      {goal.kpis.map((k) => (
        <tr key={`${goal.goal_id}-${k.kpi_code}`}>
          <td style={{ paddingLeft: 32 }} className="muted small">{k.name} <span className="mono">({k.kpi_code})</span></td>
          <td />
          <td className="small">{percent(k.result?.achievement_pct)}</td>
          <td>{k.result ? <KpiStatus status={k.result.status} /> : <span className="muted small">Not calculated</span>}</td>
          <td className="muted small">
            {k.result ? `${k.result.actual_value ?? '—'} of ${k.result.target_value ?? 'no target'}${k.result.frozen ? ' · frozen' : ''}` : ''}
          </td>
          <td />
        </tr>
      ))}
    </>
  )
}
