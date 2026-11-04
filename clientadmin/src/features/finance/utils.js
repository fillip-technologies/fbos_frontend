// Labels and money helpers for expenses and investments.

export const APPROVAL_LABELS = { pending_approval: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected' }
export const PAYMENT_LABELS = { unpaid: 'Not paid', paid: 'Paid' }
// Badge colours: styles.css has no `unpaid` / `matured`, so they borrow the nearest existing ones.
export const PAYMENT_BADGE = { unpaid: 'pending', paid: 'paid' }
export const INVESTMENT_STATUS_LABELS = { active: 'Active', matured: 'Matured', closed: 'Closed' }
export const INVESTMENT_STATUS_BADGE = { active: 'active', matured: 'completed', closed: 'closed' }

export const INVESTMENT_TYPES = {
  fixed_deposit: 'Fixed deposit',
  mutual_fund: 'Mutual fund',
  equity: 'Equity (shares)',
  bond: 'Bond',
  property: 'Property',
  other: 'Other',
}

export const INCOME_TYPES = {
  interest: 'Interest',
  returns: 'Returns',
  capital_gain: 'Capital gain',
  dividend: 'Dividend',
  rent: 'Rent',
  other: 'Other',
}

// What is recorded elsewhere, so the Command Center never counts it twice.
export const NOT_HERE =
  'Don’t record here: hardware bought on purchase orders (Inventory), costs of a tracked asset or subscription (Assets), salaries (Payroll) or costs of delivering a project (the project’s cost entries).'

export const num = (v) => Number(v ?? 0)

export function money(amount, currency = 'INR') {
  if (amount === null || amount === undefined || amount === '') return '—'
  try {
    return num(amount).toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 })
  } catch {
    return `${num(amount).toFixed(2)} ${currency}`
  }
}

// "1250.5" from an input, or null when empty: the backend takes money as a decimal string.
export const amountOrNull = (value) => (value === '' || value === null || value === undefined ? null : String(value).trim())

// Only the fields that differ from `before`, so a PATCH changes nothing else.
export function changedFields(before, after) {
  return Object.fromEntries(
    Object.entries(after).filter(([key, value]) => String(before?.[key] ?? '') !== String(value ?? ''))
  )
}
