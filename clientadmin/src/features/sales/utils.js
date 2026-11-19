export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'disqualified']
// Still being worked; converted (a quotation accepted) and disqualified are closed.
export const OPEN_LEAD_STATUSES = ['new', 'contacted', 'qualified']
// The person who handles a lead, as every lead screen calls them.
export const OUTREACH_LABEL = 'Sales outreach by'
// A lead's history (GET /leads/{id}/events), in words.
export const LEAD_EVENT_LABELS = {
  created: 'Added',
  claimed: 'Claimed',
  transferred: 'Passed on',
  released: 'Put back with the unclaimed leads',
  contacted: 'Contacted (first call logged)',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  reopened: 'Reopened',
  converted: 'Converted: the customer accepted a quotation',
}
export const LEAD_SOURCES = {
  website: 'Website',
  referral: 'Referral',
  campaign: 'Campaign',
  walk_in: 'Walk-in',
  partner: 'Partner',
  other: 'Other',
}
export const DISQUALIFY_REASONS = {
  no_budget: 'No budget',
  no_need: 'No need',
  unreachable: 'Unreachable',
  duplicate: 'Duplicate',
  competitor: 'Went with a competitor',
  other: 'Other',
}
export const CONSENT_CHANNELS = {
  website_form: 'Website form',
  phone: 'Phone call',
  email: 'Email',
  in_person: 'In person',
  whatsapp: 'WhatsApp',
}
export const DEFAULT_CONSENT_TEXT = 'I agree to be contacted about my enquiry.'

// Open stages can be set by hand; won comes from an accepted quotation, lost from "Mark lost".
export const OPEN_STAGES = ['qualification', 'proposal', 'negotiation']
export const STAGES = [...OPEN_STAGES, 'won', 'lost']
export const LOST_REASONS = {
  price: 'Price',
  competitor: 'Competitor',
  no_decision: 'No decision',
  timing: 'Timing',
  scope: 'Scope',
  other: 'Other',
}

export const QUOTATION_STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Waiting for approval',
  approved: 'Approved',
  sent: 'Sent',
  changes_requested: 'Under discussion',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  superseded: 'Replaced',
  not_chosen: 'Not chosen',
}
// Revising answers the customer: a new draft revision after they have seen this one.
export const REVISABLE_STATUSES = ['sent', 'rejected', 'changes_requested']
// Why we took a quotation back.
export const WITHDRAWAL_REASONS = {
  mistake: 'Sent by mistake',
  price_change: 'Price change',
  scope_change: 'Scope change',
  customer_request: 'Customer asked us to',
  other: 'Other',
}
// A quotation's history (GET /quotations/{id}/events), in words.
export const QUOTATION_EVENT_LABELS = {
  created: 'Created',
  submitted: 'Submitted',
  approved: 'Discount approved',
  sent: 'Marked as sent',
  emailed: 'Emailed to the customer',
  changes_requested: 'Customer asked for changes',
  revised: 'Revised',
  accepted: 'Customer accepted',
  rejected: 'Customer rejected',
  withdrawn: 'Withdrawn',
  not_chosen: 'Not chosen',
  validity_extended: 'Validity changed',
  renamed: 'Renamed',
  made_main: 'Made the main quotation',
}
// Over this discount (of the subtotal) a quotation is approved before it goes out: Send
// then sends it for approval instead.
export const APPROVAL_DISCOUNT_PCT = 20
export function needsDiscountApproval(quote) {
  const subtotal = Number(quote?.totals?.subtotal?.amount || 0)
  const discount = Number(quote?.totals?.discount_total?.amount || 0)
  return subtotal > 0 && (discount / subtotal) * 100 > APPROVAL_DISCOUNT_PCT
}

// ---------- Proposals ----------
export const PROPOSAL_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  under_discussion: 'Under discussion',
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Replaced',
}
// Being worked on: one at a time per opportunity.
export const OPEN_PROPOSAL_STATUSES = ['draft', 'sent', 'under_discussion']
export const PROPOSAL_EVENT_LABELS = {
  created: 'Created',
  edited: 'Edited',
  sent: 'Marked as sent',
  emailed: 'Emailed to the customer',
  changes_requested: 'Customer feedback',
  revised: 'Revised',
  accepted: 'Customer accepted',
  rejected: 'Customer rejected',
  quoted: 'Quotation made from it',
}
export const proposalLabel = (p) => `${p.proposal_no} v${p.version_no}`
// The status in words, with the version that replaced it ("Replaced by v2").
export const proposalStatusText = (p) =>
  p.status === 'superseded' && p.replaced_by ? `Replaced by v${p.replaced_by.version_no}` : PROPOSAL_STATUS_LABELS[p.status] || p.status

// Still open on the opportunity: not yet answered for good.
export const OPEN_QUOTATION_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'changes_requested']
// "Option A - Basic", else its number and revision.
export const quotationTitle = (q) => q.name || `${q.quote_no} rev ${q.revision_no}`

// A contract goes to the customer for signing, or as a copy once active.
export const CONTRACT_EMAILABLE = ['draft', 'pending_signature', 'active', 'completed']
export const CONTRACT_TYPES = {
  project: 'Project',
  retainer: 'Retainer',
  time_and_material: 'Time and material',
  amc: 'Annual maintenance (AMC)',
}
export const PAYMENT_TRIGGERS = {
  advance: 'Advance',
  milestone: 'Milestone',
  date: 'On a date',
  monthly: 'Monthly',
  on_completion: 'On completion',
}

// What a won contract for an offering is delivered as; the contract page offers the next step.
export const FULFILMENTS = {
  none: 'Nothing to set up',
  project: 'A delivery project',
  service: 'A customer service',
}

// The kind of business an offering is (revenue's offerings.product_line): revenue by product line on
// the CEO Command Center. Blank = not said.
export const PRODUCT_LINES = {
  hardware: 'Hardware',
  software: 'Software',
  services: 'Services',
  amc: 'AMC',
  training: 'Training',
  other: 'Other',
}
export const OFFERING_UNITS = { project: 'Project', hour: 'Hour', month: 'Month', unit: 'Unit' }
export const BILLING_MODELS = {
  one_time: 'One-time',
  recurring: 'Recurring',
  milestone: 'Milestone',
  time_and_material: 'Time and material',
}

export const ACTIVITY_TYPES = {
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
  whatsapp: 'WhatsApp',
  note: 'Note',
  site_visit: 'Site visit',
}
// An answered or replaced quotation revision keeps its files but takes no new ones (a
// revision's files carry over to the next one). Mirrors revenue's subject-access rule.
export const QUOTATION_CLOSED_TO_FILES = ['accepted', 'rejected', 'superseded', 'withdrawn', 'not_chosen']

// Subject types activities are logged against.
export const SUBJECTS = {
  lead: 'commercial.lead',
  opportunity: 'commercial.opportunity',
  contract: 'commercial.contract',
}

export const humanize = (s) => (s ? (s[0].toUpperCase() + s.slice(1)).replaceAll('_', ' ') : s)

// "2026-11-30T10:15" for a datetime-local input, in local time.
export function nowLocalInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
