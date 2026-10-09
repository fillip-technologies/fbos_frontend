import { formatMoney } from '@/features/customers/utils.js'

export const newItem = () => ({ offering_id: '', description: '', quantity: '1', unit_price: '', discount_pct: '0' })

export const itemToRow = (i) => ({
  offering_id: i.offering_id,
  description: i.description || '',
  quantity: String(i.quantity),
  unit_price: String(Number(i.unit_price.amount)),
  discount_pct: String(i.discount_pct),
})

// Request items. A blank unit price means the offering's list price.
export function rowsToItems(rows, offerings) {
  return rows.map((r) => {
    const offering = offerings.find((o) => o.id === r.offering_id)
    const item = { offering_id: r.offering_id, quantity: Number(r.quantity), discount_pct: Number(r.discount_pct || 0) }
    if (r.description.trim()) item.description = r.description.trim()
    if (r.unit_price !== '') item.unit_price = { amount: Number(r.unit_price), currency: offering?.list_price.currency || 'INR' }
    return item
  })
}

// Line items of a draft quotation: offering, quantity, price and discount per line.
// Taxes and totals are worked out by the backend when saved.
export default function QuotationItemsEditor({ rows, setRows, offerings }) {
  const update = (index, k, v) => setRows(rows.map((r, i) => (i === index ? { ...r, [k]: v } : r)))
  const active = offerings.filter((o) => o.status === 'active')

  if (!offerings.length) {
    return <p className="muted">There are no offerings to quote yet. Add them on the Offerings page first.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Offering</th>
            <th>Description</th>
            <th style={{ width: 90 }}>Qty</th>
            <th style={{ width: 140 }}>Unit price</th>
            <th style={{ width: 90 }}>Disc. %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => {
            const offering = offerings.find((o) => o.id === r.offering_id)
            return (
              <tr key={index} style={{ cursor: 'default' }}>
                <td>
                  <select
                    required
                    aria-label="Offering"
                    value={r.offering_id}
                    onChange={(e) => update(index, 'offering_id', e.target.value)}
                  >
                    <option value="">— Choose —</option>
                    {(offering && offering.status !== 'active' ? [offering, ...active] : active).map((o) => (
                      <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                    ))}
                  </select>
                  {offering && (
                    <div className="muted small">
                      {formatMoney(offering.list_price)} / {offering.unit}
                      {offering.gst_rate != null && ` · GST ${offering.gst_rate}%`}
                    </div>
                  )}
                </td>
                <td>
                  <input aria-label="Description" value={r.description} onChange={(e) => update(index, 'description', e.target.value)} />
                </td>
                <td>
                  <input
                    aria-label="Quantity"
                    type="number"
                    required
                    min="0.0001"
                    step="any"
                    value={r.quantity}
                    onChange={(e) => update(index, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Unit price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={offering ? String(Number(offering.list_price.amount)) : 'List price'}
                    value={r.unit_price}
                    onChange={(e) => update(index, 'unit_price', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Discount percent"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={r.discount_pct}
                    onChange={(e) => update(index, 'discount_pct', e.target.value)}
                  />
                </td>
                <td>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn secondary small-btn"
                      aria-label="Remove line"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="btn secondary small-btn" style={{ marginTop: 8 }} onClick={() => setRows([...rows, newItem()])}>
        + Add line
      </button>
      <p className="muted small">Discounts above 20% of the subtotal need approval before the quotation can be sent.</p>
    </div>
  )
}
