import { taxConfigApi } from '@/features/tax/api.js'
import { useLookup } from '@/shared/api/useQuery.js'
import { todayIso } from '@/shared/utils/dates.js'

// Entries of one kind in effect today (categories, TDS sections, regimes...), as a catalog.
// When they can't be read (no revenue.tax.read), `entries` is empty: forms fall back to the
// organization's defaults rather than failing.
export function useTaxEntries(orgId, kind, { enabled = true } = {}) {
  const day = todayIso()
  const { data, error, loading } = useLookup(
    ['tax-entries', orgId, kind, day],
    ({ signal }) => taxConfigApi.entries(orgId, { kind, as_of: day }, { signal }),
    { enabled: Boolean(orgId) && enabled }
  )
  return { entries: data ?? [], error, loading }
}

// Tax categories to pick on offerings and invoice lines, with their rate today.
export function useTaxCategories(orgId, options) {
  const { entries: categories, error, loading } = useTaxEntries(orgId, 'category', options)
  const { entries: rates } = useTaxEntries(orgId, 'rate', options)
  const percentOf = (code) => {
    const rate = rates.find((entry) => entry.code === code)
    return rate ? Number(rate.data.percent) : null
  }
  const options_ = categories.map((entry) => ({
    code: entry.code,
    name: entry.data.name,
    treatment: entry.data.treatment,
    percent: entry.data.rate ? percentOf(entry.data.rate) : 0,
    reverseCharge: Boolean(entry.data.reverse_charge),
  }))
  return { categories: options_, error, loading }
}
