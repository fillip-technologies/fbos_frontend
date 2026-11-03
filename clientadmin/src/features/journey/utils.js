// The sale's journey as steps on a path (a "process path": done, here, next, lost), and the
// one thing to do next. Pure functions of revenue's journey answer, delivery's projects and
// what the person may do; JourneyPath draws them.

export function formatMoney(m) {
  if (!m) return null
  const amount = Number(m.amount)
  if (Number.isNaN(amount)) return `${m.amount} ${m.currency}`
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency: m.currency, maximumFractionDigits: 0 })
  } catch {
    return `${amount.toFixed(0)} ${m.currency}`
  }
}

const words = (status) => (status ? String(status).replace(/_/g, ' ') : '')

const OPEN_LEAD = ['new', 'contacted', 'qualified']
const OPEN_DEAL = ['open', 'qualification', 'proposal', 'negotiation']
const OPEN_QUOTE = ['draft', 'pending_approval', 'approved', 'sent', 'changes_requested']
const LIVE_CONTRACT = ['active', 'completed', 'expired']
const DRAFT_CONTRACT = ['draft', 'pending_signature']
const DONE_PROJECT = ['completed', 'closed']
const NOT_BILLED = ['draft', 'cancelled']

// The record a stage shows: the accepted / main one, else the latest.
function pick(records, prefer) {
  if (!records?.length) return null
  return records.find(prefer) ?? records[records.length - 1]
}

function amount(m) {
  const n = Number(m?.amount)
  return Number.isFinite(n) ? n : 0
}

/**
 * The stages of the sale. Each: { key, label, state, title, detail, to, more }.
 * state: done | current | todo | lost | skipped | hidden.
 */
export function journeyStages(journey, projects, { canSeeProjects }) {
  const hidden = new Set(journey.hidden || [])
  const quote = pick(journey.quotations, (q) => q.is_main && q.status === 'accepted') ?? pick(journey.quotations, (q) => q.is_main)
  const contract = pick(journey.contracts, (c) => c.status === 'active')
  const project = pick(projects, (p) => !DONE_PROJECT.includes(p.status))
  const billed = (journey.invoices || []).filter((i) => !NOT_BILLED.includes(i.status) && i.kind !== 'credit_note')
  const totals = journey.totals
  const due = amount(totals?.balance_due)
  const later = Boolean(contract || billed.length)
  const lostDeal = journey.opportunity?.status === 'lost'

  const stages = []
  const lead = journey.lead
  stages.push({
    key: 'lead',
    label: 'Enquiry',
    state: hidden.has('lead')
      ? 'hidden'
      : !lead
        ? journey.opportunity || later ? 'skipped' : 'todo'
        : lead.status === 'disqualified' ? 'lost' : OPEN_LEAD.includes(lead.status) ? 'current' : 'done',
    title: lead?.name || lead?.number,
    detail: lead ? words(lead.status) : null,
    to: lead && `/leads/${lead.id}`,
  })

  const opp = journey.opportunity
  stages.push({
    key: 'opportunity',
    label: 'Opportunity',
    state: hidden.has('opportunity')
      ? 'hidden'
      : !opp ? later ? 'skipped' : 'todo' : opp.status === 'won' ? 'done' : opp.status === 'lost' ? 'lost' : 'current',
    title: opp?.name,
    detail: opp ? [words(opp.status), formatMoney(opp.amount)].filter(Boolean).join(' · ') : null,
    to: opp && `/opportunities/${opp.id}`,
  })

  const quotes = journey.quotations || []
  stages.push({
    key: 'quotation',
    label: 'Quote',
    state: hidden.has('quotations')
      ? 'hidden'
      : quotes.some((q) => q.status === 'accepted') || (contract && !quotes.length)
        ? quotes.length ? 'done' : 'skipped'
        : quotes.some((q) => OPEN_QUOTE.includes(q.status)) ? lostDeal ? 'lost' : 'current' : quotes.length ? 'lost' : 'todo',
    title: quote?.number,
    detail: quote ? [words(quote.status), formatMoney(quote.amount)].filter(Boolean).join(' · ') : null,
    to: quote && `/quotations/${quote.id}`,
    more: quotes.length > 1 ? quotes.length - 1 : 0,
  })

  stages.push({
    key: 'contract',
    label: 'Contract',
    state: hidden.has('contracts')
      ? 'hidden'
      : !contract
        ? (journey.contracts || []).some((c) => c.status === 'terminated') ? 'lost' : lostDeal ? 'lost' : 'todo'
        : LIVE_CONTRACT.includes(contract.status) ? 'done' : DRAFT_CONTRACT.includes(contract.status) ? 'current' : 'lost',
    title: contract?.number,
    detail: contract ? words(contract.status) : null,
    to: contract && `/contracts/${contract.id}`,
  })

  if (canSeeProjects) {
    stages.push({
      key: 'project',
      label: 'Delivery',
      state: !project ? (contract && billed.length ? 'skipped' : 'todo') : DONE_PROJECT.includes(project.status) ? 'done' : 'current',
      title: project?.name,
      detail: project ? words(project.status) : null,
      to: project && `/projects/${project.id}`,
      more: (projects?.length || 0) > 1 ? projects.length - 1 : 0,
    })
  }

  const lastInvoice = billed[billed.length - 1]
  stages.push({
    key: 'invoice',
    label: 'Invoice',
    state: hidden.has('invoices') ? 'hidden' : billed.length ? 'done' : 'todo',
    title: billed.length ? `${billed.length} invoice${billed.length === 1 ? '' : 's'}` : null,
    detail: totals && billed.length ? formatMoney(totals.invoiced) : null,
    to: lastInvoice && `/invoices/${lastInvoice.id}`,
  })

  const late = billed.some((i) => i.status === 'overdue')
  stages.push({
    key: 'paid',
    label: 'Paid',
    state: hidden.has('payments') || hidden.has('invoices')
      ? 'hidden'
      : !billed.length ? 'todo' : due <= 0 ? 'done' : late ? 'late' : 'current',
    title: billed.length ? (due <= 0 ? 'Paid in full' : `${formatMoney(totals?.balance_due)} due`) : null,
    detail: billed.length && totals ? `${formatMoney(totals.received)} received` : null,
    to: journey.payments?.length ? `/payments/${journey.payments[journey.payments.length - 1].id}` : null,
  })
  return stages
}

/**
 * The one thing to do next, or null: { text, action?: { label, to } }. `can` holds what the
 * person may do ({ manageContracts, manageProjects, billingSchedules, recordPayments, ... }).
 */
export function nextStep(journey, stages, projects, can) {
  const by = Object.fromEntries(stages.map((s) => [s.key, s]))
  const client = journey.client
  const contract = pick(journey.contracts, (c) => c.status === 'active')
  if (journey.opportunity?.status === 'lost' || (by.lead?.state === 'lost' && !journey.opportunity)) {
    return { tone: 'lost', text: 'This sale was lost. Nothing more to do here.' }
  }
  if (by.lead?.state === 'current') {
    return { text: 'Qualify the enquiry, then convert it into an opportunity.', action: { label: 'Open the enquiry', to: by.lead.to } }
  }
  if (by.opportunity?.state === 'current' && by.quotation?.state === 'todo') {
    return { text: 'Prepare a quotation for this opportunity.', action: { label: 'Open the opportunity', to: by.opportunity.to } }
  }
  if (by.quotation?.state === 'current') {
    const q = pick(journey.quotations, (x) => x.is_main && OPEN_QUOTE.includes(x.status)) ?? pick(journey.quotations, (x) => OPEN_QUOTE.includes(x.status))
    const texts = {
      draft: 'Finish the quotation and submit it.',
      pending_approval: can.approveQuotations ? 'A quotation is waiting for your approval.' : 'The quotation is waiting for approval.',
      approved: 'The quotation is approved: send it to the customer.',
      sent: 'The quotation is with the customer. Follow up for their answer.',
      changes_requested: 'The customer asked for changes: revise the quotation.',
    }
    return { text: texts[q?.status] || 'Move the quotation forward.', action: q && { label: `Open ${q.number || 'the quotation'}`, to: `/quotations/${q.id}` } }
  }
  if (by.quotation?.state === 'done' && by.contract?.state === 'todo') {
    return {
      text: 'The quotation was accepted. Create the contract from the opportunity.',
      action: can.manageContracts && by.opportunity?.to ? { label: 'Create the contract', to: by.opportunity.to } : null,
    }
  }
  if (by.contract?.state === 'current') {
    return { text: 'Attach the signed copy, then activate the contract to start delivery and billing.', action: { label: 'Open the contract', to: by.contract.to } }
  }
  if (contract && by.project?.state === 'todo' && can.manageProjects && client) {
    return {
      text: 'The contract is active. Start the delivery project, if this sale needs one.',
      action: { label: 'Start the project', to: `/projects/new?customer=${client.id}&contract=${contract.id}` },
    }
  }
  if (contract && by.invoice?.state === 'todo') {
    return {
      text: 'Nothing is billed yet. Each payment term is billed from the schedule when it falls due.',
      action: can.billingSchedules ? { label: 'See what is ready to bill', to: `/billing-schedules?contract=${contract.id}` } : null,
    }
  }
  if (by.paid?.state === 'current' || by.paid?.state === 'late') {
    const owing = (journey.invoices || []).find((i) => !NOT_BILLED.includes(i.status) && i.kind !== 'credit_note' && i.status !== 'paid')
    return {
      tone: by.paid.state === 'late' ? 'late' : null,
      text: `${formatMoney(journey.totals?.balance_due)} is still to be paid${by.paid.state === 'late' ? ', and some of it is overdue' : ''}.`,
      action: can.recordPayments && client
        ? { label: 'Record a payment', to: `/payments/new?customer=${client.id}${owing ? `&invoice=${owing.id}` : ''}` }
        : null,
    }
  }
  if (by.paid?.state === 'done') return { tone: 'done', text: 'Billed and paid in full.' }
  return null
}
