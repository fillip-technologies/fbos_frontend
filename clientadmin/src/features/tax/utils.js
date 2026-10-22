// Labels and one-line summaries for tax configuration. What each kind may hold is decided by
// the backend (finance/tax/config_schema.py); these only present it.

export const CONFIG_KINDS = {
  rate: 'Rates',
  category: 'Tax categories',
  rule: 'Rules',
  component: 'Tax components',
  jurisdiction: 'States & territories',
  withholding_section: 'TDS sections',
  deadline: 'Deadlines',
  series_template: 'Number formats',
  regime: 'Tax systems',
}

export const SUPPLY_TYPES = {
  intra_state: 'Within the state',
  inter_state: 'Between states',
  export: 'Export',
}

export const BEHAVIOURS = {
  added: 'Charged',
  collected: 'Collected',
  reverse_charge: 'Reverse charge (customer pays)',
  withheld: 'Withheld',
}

export const BILLING_MODES = {
  staged: 'Staged: one invoice per payment term, when it falls due',
  full_upfront: 'Upfront: one invoice for the whole contract on its start date',
  manual: 'Manual: no schedule, invoices are drafted by hand',
}

export const DEADLINE_MODES = {
  block: 'Refuse it',
  warn_with_reason: 'Allow it with a reason, which is kept on the credit note',
}

export const TDS_STATUSES = {
  expected: 'Expected',
  reflected: 'Seen in 26AS',
  certificate_received: 'Certificate received',
  claimed: 'Claimed',
  mismatch: 'Mismatch',
  written_off: 'Written off',
}

export const PACK_ACTIONS = {
  add: 'Add',
  update: 'Update',
  conflict: 'Conflict',
  retire: 'Retire',
}

const list = (values) => (values || []).join(', ')

function ruleSummary(data) {
  const when = Object.entries(data.when || {})
    .map(([fact, value]) => `${fact.replace(/_/g, ' ')} ${Array.isArray(value) ? `is ${list(value)}` : `= ${value}`}`)
    .join(' and ')
  const then = (data.then || [])
    .map((out) => {
      const rate = out.percent != null ? `${out.percent}%` : out.rate || 'category rate'
      const share = Number(out.split ?? 1) !== 1 ? ` × ${out.split}` : ''
      return `${out.component} ${rate}${share}${out.behaviour === 'reverse_charge' ? ' (reverse charge)' : ''}`
    })
    .join(' + ')
  return `When ${when || 'anything'} → ${then || 'no tax'} · priority ${data.priority}`
}

// A short, human description of an entry's data, per kind.
export function entrySummary(kind, data) {
  switch (kind) {
    case 'rate':
      return `${Number(data.percent)}%${data.notification ? ` · ${data.notification}` : ''}`
    case 'category':
      return `${data.name} · ${data.treatment}${data.rate ? ` · ${data.rate}` : ''}${data.reverse_charge ? ' · reverse charge' : ''}`
    case 'rule':
      return ruleSummary(data)
    case 'component':
      return `${data.label} · ${data.behaviour || 'added'}${data.base === 'taxable_plus_previous' ? ' · compound' : ''}`
    case 'jurisdiction':
      return `${data.name} · ${data.kind.replace(/_/g, ' ')}`
    case 'withholding_section':
      return `${data.nature} · ${data.statute_ref} · ${Object.entries(data.rates || {}).map(([who, pct]) => `${who} ${Number(pct)}%`).join(', ')}`
    case 'deadline':
      return data.description
    case 'series_template':
      return `${data.format.replace('{prefix}', data.prefix)} · resets ${data.reset.replace(/_/g, ' ')}`
    case 'regime':
      return `${data.name} · ${data.country} · ${data.kind}`
    default:
      return JSON.stringify(data)
  }
}

export const isInEffect = (entry, day) =>
  entry.effective_from <= day && (!entry.effective_to || day < entry.effective_to)

// A month as YYYY-MM, for the GST-vs-cash report.
export const thisMonth = () => new Date().toISOString().slice(0, 7)

// Revenue puts an error's extra facts (the problems found, the deadline passed...) in
// `detail.meta`; the HTTP layer keeps the raw body as `details`.
export const errorMeta = (err) => err?.details?.detail?.meta ?? err?.details?.meta ?? null
