import { Link, useLocation } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { journeyApi } from '@/features/journey/api.js'
import { formatMoney, journeyStages, nextStep } from '@/features/journey/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'

const STATE_WORDS = {
  done: 'done',
  current: 'in progress',
  late: 'overdue',
  todo: 'not yet',
  lost: 'stopped',
  skipped: 'skipped',
  hidden: 'not shown to you',
}

const ICONS = {
  done: <path d="M5 12.5l4.2 4.2L19 7" />,
  lost: <path d="M7 7l10 10M17 7L7 17" />,
  late: <path d="M12 7v6M12 16.5h.01" />,
}

function StageMark({ state, index }) {
  const icon = ICONS[state]
  return (
    <span className="journey-mark" aria-hidden="true">
      {icon ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      ) : (
        index + 1
      )}
    </span>
  )
}

/**
 * Where this record's sale stands, lead to payment: a path of steps (each a link to its record),
 * the step this page is, and the one thing to do next. `subject` is the record this page shows
 * (lead | opportunity | quotation | contract | invoice), or 'project' with `contractId`; `version`
 * refetches the journey when the record changes.
 */
export default function JourneyPath({ subject, id, version, contractId }) {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const { pathname } = useLocation()
  const asProject = subject === 'project'
  const source = asProject ? 'contract' : subject
  const sourceId = asProject ? contractId : id
  const readable = {
    lead: ACCESS.leads,
    opportunity: ACCESS.opportunities,
    quotation: ACCESS.opportunities,
    contract: ACCESS.contracts,
    invoice: ACCESS.invoices,
  }[source]
  const enabled = Boolean(orgId && sourceId && readable && hasAccess(me, readable))

  const { data: journey } = useQuery(
    ['journey', orgId, source, sourceId, version ?? null],
    ({ signal }) => journeyApi.get(orgId, source, sourceId, { signal }),
    { enabled },
  )
  const canSeeProjects = hasAccess(me, ACCESS.projects)
  const contract = journey?.contracts?.find((c) => c.status === 'active') ?? journey?.contracts?.[journey.contracts.length - 1]
  const { data: projectPage } = useQuery(
    ['journey-projects', orgId, contract?.id],
    ({ signal }) => journeyApi.projects(orgId, contract.id, { signal }),
    { enabled: Boolean(enabled && contract && canSeeProjects) },
  )

  // Nothing to show until it loads, and nothing for a record that stands alone (a one-off invoice).
  if (!journey) return null
  const projects = projectPage?.data ?? []
  const stages = journeyStages(journey, projects, { canSeeProjects })
  const known = stages.filter((s) => s.to).length
  if (known < 2 && subject !== 'lead' && subject !== 'opportunity') return null

  const here = asProject ? 'project' : subject
  const next = nextStep(journey, stages, projects, {
    approveQuotations: hasAccess(me, ACCESS.approveQuotations),
    manageContracts: hasAccess(me, ACCESS.manageContracts),
    manageProjects: hasAccess(me, ACCESS.manageProjects),
    billingSchedules: hasAccess(me, ACCESS.billingSchedules),
    recordPayments: hasAccess(me, ACCESS.recordPayments),
  })
  const onThisPage = (to) => Boolean(to) && pathname === to.split('?')[0]

  return (
    <section className="journey" aria-label="Where this sale stands">
      <div className="journey-head">
        <span className="journey-title">
          Sale journey
          {journey.client && (
            <>
              {' · '}
              <Link to={`/customers/${journey.client.id}`}>{journey.client.name}</Link>
            </>
          )}
        </span>
        {journey.totals && Number(journey.totals.invoiced.amount) > 0 && (
          <span className="journey-money">
            <span>Billed <b>{formatMoney(journey.totals.invoiced)}</b></span>
            <span>Received <b>{formatMoney(journey.totals.received)}</b></span>
            <span>Due <b>{formatMoney(journey.totals.balance_due)}</b></span>
          </span>
        )}
      </div>
      <ol className="journey-path">
        {stages.map((stage, i) => {
          const isHere = stage.key === here
          const body = (
            <>
              <StageMark state={stage.state} index={i} />
              <span className="journey-text">
                <span className="journey-label">
                  {stage.label}
                  <span className="visually-hidden">: {STATE_WORDS[stage.state]}</span>
                </span>
                <span className="journey-sub">
                  {stage.state === 'hidden' ? 'Not shown' : stage.title || (stage.state === 'skipped' ? 'Skipped' : 'Not yet')}
                  {stage.more > 0 && <span className="journey-more"> +{stage.more}</span>}
                </span>
              </span>
            </>
          )
          return (
            <li
              key={stage.key}
              className={`journey-stage is-${stage.state}${isHere ? ' is-here' : ''}`}
              aria-current={isHere ? 'step' : undefined}
              title={[stage.label, stage.detail || STATE_WORDS[stage.state]].join(': ')}
            >
              {stage.to && !onThisPage(stage.to) ? <Link to={stage.to}>{body}</Link> : <span>{body}</span>}
            </li>
          )
        })}
      </ol>
      {next && (
        <div className={`journey-next${next.tone ? ` is-${next.tone}` : ''}`}>
          <span className="journey-next-label">{next.tone === 'done' || next.tone === 'lost' ? 'Status' : 'Next step'}</span>
          <span className="journey-next-text">{next.text}</span>
          {next.action && !onThisPage(next.action.to) && (
            <Link className="btn small-btn" to={next.action.to}>
              {next.action.label}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
