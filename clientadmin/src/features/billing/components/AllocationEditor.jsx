import { formatMoney } from '@/features/customers/utils.js'
import { formatDate } from '@/shared/utils/format.js'
import { amountOf, expectedTds, round2 } from '@/features/billing/utils.js'

// `rows` maps invoice id → { cash, tds } as typed. Cash comes out of the payment; TDS is what
// the customer withheld for that invoice: it settles the invoice too, and is tracked as owed
// by the government until it shows in Form 26AS.
const cashOf = (row) => Number(row?.cash || 0)
const tdsOf = (row) => Number(row?.tds || 0)

// Cash allocated across invoices (what must fit in the payment).
export const allocatedTotal = (rows) => round2(Object.values(rows).reduce((sum, row) => sum + cashOf(row), 0))

// Request allocations for the rows that settle something.
export const toAllocations = (rows, currency) =>
  Object.entries(rows)
    .filter(([, row]) => cashOf(row) > 0 || tdsOf(row) > 0)
    .map(([invoiceId, row]) => {
      const allocation = { invoice_id: invoiceId, amount: { amount: cashOf(row), currency } }
      if (tdsOf(row) > 0) allocation.tds_amount = { amount: tdsOf(row), currency }
      return allocation
    })

// What the customer is expected to pay in cash on an invoice: its balance less the TDS it may withhold.
export const cashExpected = (inv) => round2(Math.max(amountOf(inv.balance_due) - expectedTds(inv), 0))

// Splits a payment across a customer's open invoices and debit notes.
export default function AllocationEditor({ invoices, rows, setRows, available }) {
  const total = allocatedTotal(rows)
  const over = total > available + 0.001
  const setRow = (id, k, v) => setRows({ ...rows, [id]: { ...rows[id], [k]: v } })

  // Oldest due first: the cash each invoice is expected to pay, plus its expected TDS, until the money runs out.
  function fillOldestFirst() {
    let left = available
    const next = {}
    const byDue = [...invoices].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    for (const inv of byDue) {
      const cash = round2(Math.min(left, cashExpected(inv)))
      if (cash <= 0) break
      const tds = cash >= cashExpected(inv) ? round2(Math.min(expectedTds(inv), amountOf(inv.balance_due) - cash)) : 0
      next[inv.id] = { cash: String(cash), tds: tds > 0 ? String(tds) : '' }
      left = round2(left - cash)
    }
    setRows(next)
  }

  if (!invoices.length) return <p className="muted small">This customer has no open invoices. The money stays unallocated.</p>

  return (
    <div>
      <div className="section-head">
        <span className="muted small">Settle open invoices with this payment, and record the TDS the customer withheld from each.</span>
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
            <th style={{ width: 140 }}>Cash</th>
            <th style={{ width: 140 }}>TDS withheld</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const row = rows[inv.id]
            const tooMuch = cashOf(row) + tdsOf(row) > amountOf(inv.balance_due) + 0.001
            const expected = expectedTds(inv)
            return (
              <tr key={inv.id} style={{ cursor: 'default' }}>
                <td className="mono">
                  {inv.invoice_no}
                  {inv.doc_type === 'debit_note' && <div className="muted small">Debit note</div>}
                </td>
                <td>{formatDate(inv.due_date)}</td>
                <td style={{ textAlign: 'right' }}>
                  {formatMoney(inv.balance_due)}
                  {tooMuch && <div className="field-error small">More than it owes</div>}
                </td>
                <td>
                  <input
                    aria-label={`Cash for ${inv.invoice_no}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={row?.cash || ''}
                    onChange={(e) => setRow(inv.id, 'cash', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`TDS withheld for ${inv.invoice_no}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={expected > 0 ? `Expected ${expected.toFixed(2)}` : ''}
                    value={row?.tds || ''}
                    onChange={(e) => setRow(inv.id, 'tds', e.target.value)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={over ? 'field-error' : 'muted small'} style={{ textAlign: 'right' }}>
        Cash allocated {total.toFixed(2)} of {available.toFixed(2)}
        {over && ' — more than the payment has left'}
      </p>
    </div>
  )
}

// Whether every row fits its invoice's balance.
export const rowsFit = (rows, invoices) =>
  invoices.every((inv) => cashOf(rows[inv.id]) + tdsOf(rows[inv.id]) <= amountOf(inv.balance_due) + 0.001)
