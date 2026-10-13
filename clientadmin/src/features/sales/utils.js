export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'disqualified']
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
  changes_requested: 'Changes requested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
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
// Still open on the opportunity: not yet answered for good.
export const OPEN_QUOTATION_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'changes_requested']
// "Option A - Basic", else its number and revision.
export const quotationTitle = (q) => q.name || `${q.quote_no} rev ${q.revision_no}`

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
