// Pure helpers for the CEO Command Center: periods, money and change against the period before.

export function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The period choices. Each returns { from, to } (inclusive) for `today`.
export const RANGES = [
  { key: 'this_month', label: 'This month', period: (t) => ({ from: new Date(t.getFullYear(), t.getMonth(), 1), to: t }) },
  {
    key: 'last_month',
    label: 'Last month',
    period: (t) => ({ from: new Date(t.getFullYear(), t.getMonth() - 1, 1), to: new Date(t.getFullYear(), t.getMonth(), 0) }),
  },
  { key: 'last_3_months', label: '3 months', period: (t) => ({ from: new Date(t.getFullYear(), t.getMonth() - 2, 1), to: t }) },
  { key: 'last_12_months', label: '12 months', period: (t) => ({ from: new Date(t.getFullYear(), t.getMonth() - 11, 1), to: t }) },
]

export function periodFor(rangeKey, today = new Date()) {
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0]
  const { from, to } = range.period(today)
  return { from: isoDay(from), to: isoDay(to) }
}

export const num = (n) => Number(n ?? 0)
export const count = (n) => Math.round(num(n)).toLocaleString()

export function money(amount, currency = 'INR', compact = true) {
  try {
    return num(amount).toLocaleString(undefined, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    })
  } catch {
    return `${count(amount)} ${currency}`
  }
}

// Change against the period before as { text, tone }, or null when there is nothing to compare.
// `higherIsBetter` false for costs: spending more reads as bad.
export function change(value, previous, { higherIsBetter = true } = {}) {
  if (previous === null || previous === undefined || value === null || value === undefined) return null
  const now = num(value)
  const before = num(previous)
  if (before === 0) return now === 0 ? { text: 'Same as before', tone: '' } : { text: 'New this period', tone: '' }
  const pctChange = Math.round(((now - before) / Math.abs(before)) * 100)
  if (pctChange === 0) return { text: 'Same as before', tone: '' }
  const better = pctChange > 0 === higherIsBetter
  return { text: `${pctChange > 0 ? '+' : ''}${pctChange}% vs previous period`, tone: better ? 'good' : 'bad' }
}

// Why a card has no numbers, in plain words (the gateway's `reason`).
export const REASON_TEXT = {
  no_access: 'No access',
  unavailable: 'Can’t load right now',
  not_set_up: 'Not set up yet',
}

export const HEALTH_TEXT = {
  excellent: 'Excellent',
  good: 'Good',
  needs_attention: 'Needs attention',
  critical: 'Critical',
}

const LABELS = {
  none: 'Not recorded',
  company: 'Private company',
  individual: 'Individual',
  government: 'Government',
  project: 'Project',
  retainer: 'Retainer',
  time_and_material: 'Time & material',
  amc: 'AMC',
  full_time: 'Full time',
  part_time: 'Part time',
  contractor: 'Contractor',
  intern: 'Intern',
  freelancer: 'Freelancer',
  payroll: 'Salaries (payroll)',
  project_costs: 'Project costs',
  procurement: 'Purchases (inventory)',
  asset_costs: 'Software & assets',
  hardware: 'Hardware',
  software: 'Software',
  services: 'Services',
  training: 'Training',
  other: 'Other',
  own: 'Own companies',
  associate: 'Associate companies (total)',
  investment: 'Investments',
  government: 'Government',
  private: 'Private',
  india: 'India',
  international: 'International',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_received: 'Part received',
  received: 'Received',
  cancelled: 'Cancelled',
}
export const label = (key) => LABELS[key] ?? String(key).replace(/_/g, ' ')

// "Government · India": a customer segment, sector by market.
export const segmentLabel = (s) => `${label(s.sector)} · ${label(s.market)}`
