import { Link } from 'react-router-dom'
import { OPEN_QUOTATION_STATUSES, QUOTATION_STATUS_LABELS, humanize } from '@/features/sales/utils.js'

const STATE_WORDS = { done: 'done', current: 'in progress', todo: 'not yet', lost: 'stopped', skipped: 'skipped' }

const ICONS = {
  done: <path d="M5 12.5l4.2 4.2L19 7" />,
  lost: <path d="M7 7l10 10M17 7L7 17" />,
}

/**
 * The five steps of a sale as the team talks about it — Lead → Proposal → Quotation → Contract →
 * Customer — worked out from what the opportunity page already loads. The proposal is this page.
 */
export function dealSteps({ opp, quotations, contracts, customer, canSeeContracts }) {
  const accepted = quotations.find((q) => q.status === 'accepted')
  const openQuote =
    quotations.find((q) => q.is_main && OPEN_QUOTATION_STATUSES.includes(q.status)) ||
    quotations.find((q) => OPEN_QUOTATION_STATUSES.includes(q.status))
  const contract = contracts.find((c) => c.status === 'active') || contracts[0]
  const lost = opp.stage === 'lost'
  const isCustomer = Boolean(accepted) || (customer && customer.status !== 'prospect')

  return [
    {
      key: 'lead',
      label: 'Lead',
      state: opp.lead_id ? 'done' : 'skipped',
      sub: opp.lead_id ? 'Converted' : 'Added directly',
      to: opp.lead_id ? `/leads/${opp.lead_id}` : null,
    },
    {
      key: 'proposal',
      label: 'Proposal',
      state: lost ? 'lost' : opp.stage === 'won' ? 'done' : 'current',
      sub: humanize(opp.stage),
      here: true,
    },
    {
      key: 'quotation',
      label: 'Quotation',
      state: accepted ? 'done' : lost ? 'todo' : openQuote ? 'current' : 'todo',
      sub: accepted
        ? `${accepted.quote_no} accepted`
        : openQuote
          ? `${openQuote.quote_no} · ${QUOTATION_STATUS_LABELS[openQuote.status] || humanize(openQuote.status)}`
          : 'Not yet',
      to: (accepted || openQuote) && `/quotations/${(accepted || openQuote).id}`,
    },
    {
      key: 'contract',
      label: 'Contract',
      state: !canSeeContracts ? 'todo' : contract?.status === 'active' ? 'done' : contract ? 'current' : 'todo',
      sub: !canSeeContracts ? 'Not shown' : contract ? `${contract.contract_no} · ${humanize(contract.status)}` : 'Not yet',
      to: canSeeContracts && contract ? `/contracts/${contract.id}` : null,
    },
    {
      key: 'customer',
      label: 'Customer',
      state: isCustomer ? 'done' : 'todo',
      sub: isCustomer ? opp.client.name : 'Still a prospect',
      to: `/customers/${opp.client.id}`,
    },
  ]
}

export default function DealStepper({ steps }) {
  return (
    <ol className="journey-path deal-stepper" aria-label="Where this deal stands">
      {steps.map((step, i) => {
        const icon = ICONS[step.state]
        const body = (
          <>
            <span className="journey-mark" aria-hidden="true">
              {icon ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {icon}
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="journey-text">
              <span className="journey-label">
                {step.label}
                {step.here && <span className="deal-here"> · this page</span>}
                <span className="visually-hidden">: {STATE_WORDS[step.state]}</span>
              </span>
              <span className="journey-sub">{step.sub}</span>
            </span>
          </>
        )
        return (
          <li
            key={step.key}
            className={`journey-stage is-${step.state}${step.here ? ' is-here' : ''}`}
            aria-current={step.here ? 'step' : undefined}
          >
            {step.to && !step.here ? <Link to={step.to}>{body}</Link> : <span>{body}</span>}
          </li>
        )
      })}
    </ol>
  )
}
