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
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Superseded',
  expired: 'Expired',
}
// Revising makes a new draft; an accepted or superseded quotation is final.
export const REVISABLE_STATUSES = ['pending_approval', 'approved', 'sent', 'rejected']

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
export const QUOTATION_CLOSED_TO_FILES = ['accepted', 'rejected', 'superseded']

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
