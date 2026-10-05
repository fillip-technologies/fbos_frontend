// GST state codes (the first two characters of a GSTIN). A customer's GSTIN must start
// with the code of its billing state, which the backend checks.
export const GST_STATES = [
  ['01', 'Jammu and Kashmir'],
  ['02', 'Himachal Pradesh'],
  ['03', 'Punjab'],
  ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'],
  ['06', 'Haryana'],
  ['07', 'Delhi'],
  ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'],
  ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'],
  ['14', 'Manipur'],
  ['15', 'Mizoram'],
  ['16', 'Tripura'],
  ['17', 'Meghalaya'],
  ['18', 'Assam'],
  ['19', 'West Bengal'],
  ['20', 'Jharkhand'],
  ['21', 'Odisha'],
  ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['27', 'Maharashtra'],
  ['29', 'Karnataka'],
  ['30', 'Goa'],
  ['31', 'Lakshadweep'],
  ['32', 'Kerala'],
  ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'],
  ['97', 'Other Territory'],
].map(([code, name]) => ({ code, name }))

export const CUSTOMER_TYPES = { company: 'Company', individual: 'Individual', government: 'Government' }
export const CUSTOMER_STATUSES = ['prospect', 'active', 'inactive']

export const MANAGED_BY = { us: 'By us', client: 'By the customer', third_party: 'By a third party' }
export const BILLING_CYCLES = {
  one_time: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
  other: 'Other',
}
export const SERVICE_STATUSES = ['active', 'expired', 'cancelled']

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// ---------- Billing address ----------
export const EMPTY_ADDRESS = { line1: '', line2: '', city: '', state_code: '', postal_code: '', country: 'IN' }

export const addressToForm = (a) => ({ ...EMPTY_ADDRESS, ...(a || {}), line2: a?.line2 || '' })

// The backend stores both the state name and its GST code; the form picks the code.
export function addressFromForm(a) {
  const state = GST_STATES.find((s) => s.code === a.state_code)
  const address = {
    line1: a.line1.trim(),
    city: a.city.trim(),
    state: state?.name || a.state || '',
    state_code: a.state_code,
    postal_code: a.postal_code.trim(),
    country: a.country.trim() || 'IN',
  }
  if (a.line2.trim()) address.line2 = a.line2.trim()
  return address
}

export function formatAddress(a) {
  if (!a) return '—'
  return [a.line1, a.line2, a.city, a.state && `${a.state} (${a.state_code})`, a.postal_code].filter(Boolean).join(', ')
}

// ---------- Money ----------
// Amounts travel as decimal strings ("1500.00").
export function formatMoney(m) {
  if (!m) return '—'
  const amount = Number(m.amount)
  if (Number.isNaN(amount)) return `${m.amount} ${m.currency}`
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency: m.currency })
  } catch {
    return `${amount.toFixed(2)} ${m.currency}`
  }
}

// ---------- Client service form ----------
export function serviceToForm(s, defaultCurrency = 'INR') {
  return {
    provider_id: s?.provider?.id || '',
    category_id: s?.category?.id || '',
    name: s?.name || '',
    reference_no: s?.reference_no || '',
    managed_by: s?.managed_by || 'client',
    start_date: s?.start_date || '',
    end_date: s?.end_date || '',
    renewal_date: s?.renewal_date || '',
    auto_renew: Boolean(s?.auto_renew),
    cost_amount: s?.cost ? String(Number(s.cost.amount)) : '',
    cost_currency: s?.cost?.currency || defaultCurrency,
    billing_cycle: s?.billing_cycle || '',
    status: s?.status || 'active',
    notes: s?.notes || '',
  }
}

// The request body for a form. Optional fields left blank are sent as null so an edit
// can clear them; on create, nulls are simply the defaults.
export function serviceFromForm(f) {
  const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v)
  return {
    provider_id: f.provider_id,
    category_id: f.category_id || null,
    name: f.name.trim(),
    reference_no: blankToNull(f.reference_no),
    managed_by: f.managed_by,
    start_date: f.start_date || null,
    end_date: f.end_date || null,
    renewal_date: f.renewal_date || null,
    auto_renew: f.auto_renew,
    cost: f.cost_amount === '' ? null : { amount: Number(f.cost_amount), currency: f.cost_currency.trim().toUpperCase() },
    billing_cycle: f.billing_cycle || null,
    status: f.status,
    notes: blankToNull(f.notes),
  }
}

// Only what changed since `original` (both request bodies), for a PATCH.
export function changedFields(original, next) {
  const changes = {}
  for (const [k, v] of Object.entries(next)) {
    if (JSON.stringify(v) !== JSON.stringify(original[k])) changes[k] = v
  }
  return changes
}
