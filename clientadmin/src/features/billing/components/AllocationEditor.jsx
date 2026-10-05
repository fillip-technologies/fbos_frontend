import { formatMoney } from '@/features/customers/utils.js'
import { formatDate } from '@/shared/utils/format.js'
import { amountOf, round2 } from '@/features/billing/utils.js'

// Total of the amounts typed against invoices.
export const allocatedTotal = (amounts) => round2(Object.values(amounts).reduce((sum, v) => sum + Number(v || 0), 0))

// Request allocations for the non-zero amounts.
export const toAllocations = (amounts, currency) =>
  Object.entries(amounts)
    .filter(([, v]) => Number(v) > 0)
    .map(([invoiceId, v]) => ({ invoice_id: invoiceId, amount: { amount: Number(v), currency } }))

// Splits a payment across a customer's open invoices. `amounts` maps invoice id → typed amount.
export default function AllocationEditor({ invoices, amounts, setAmounts, available }) {
  const total = allocatedTotal(amounts)
  const over = total > available + 0.001

  // Oldest due first, as much as each invoice owes, until the money runs out.
  function fillOldestFirst() {
    let left = available
    const next = {}
    const byDue = [...invoices].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    for (const inv of byDue) {
      const take = round2(Math.min(left, amountOf(inv.balance_due)))
      if (take <= 0) break
      next[inv.id] = String(take)
      left = round2(left - take)
    }
    setAmounts(next)
  }

  if (!invoices.length) return <p className="muted small">This customer has no open invoices. The money stays unallocated.</p>

  return (
    <div>
      <div className="section-head">
        <span className="muted small">Settle open invoices with this payment.</span>
        <button type="button" className="btn secondary small-btn" onClick={fillOldestFirst} disabled={available <= 0}>
          Fill oldest first
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Due</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
            <th style={{ width: 150 }}>Allocate</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} style={{ cursor: 'default' }}>
              <td className="mono">{inv.invoice_no}</td>
              <td>{formatDate(inv.due_date)}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(inv.balance_due)}</td>
              <td>
                <input
                  aria-label={`Allocate to ${inv.invoice_no}`}
                  type="number"
                  min="0"
                  max={amountOf(inv.balance_due)}
                  step="0.01"
                  value={amounts[inv.id] || ''}
                  onChange={(e) => setAmounts({ ...amounts, [inv.id]: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={over ? 'field-error' : 'muted small'} style={{ textAlign: 'right' }}>
        Allocated {total.toFixed(2)} of {available.toFixed(2)}
        {over && ' — more than the payment has left'}
      </p>
    </div>
  )
}
