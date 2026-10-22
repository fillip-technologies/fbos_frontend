import { formatMoney } from '@/features/customers/utils.js'

const Row = ({ label, children, strong, muted = true }) => (
  <tr style={{ cursor: 'default' }}>
    <td className={muted && !strong ? 'muted' : undefined} style={strong ? { fontWeight: 700 } : undefined}>{label}</td>
    <td style={{ textAlign: 'right', ...(strong ? { fontWeight: 700 } : {}) }}>{children}</td>
  </tr>
)

// A document's totals from its generic `taxes` list (CGST, SGST, UTGST, IGST, cess, VAT...):
// what is charged, what the customer pays under reverse charge, round-off, and the TDS the
// customer may withhold with what is then expected in cash. Falls back to the older
// cgst/sgst/igst fields for documents saved before taxes were itemised.
export default function TaxTotals({ totals, withholding = [], netReceivable, extraRows = [] }) {
  const taxes = totals.taxes?.length
    ? totals.taxes
    : [
        ['CGST', totals.cgst_total ?? totals.cgst],
        ['SGST', totals.sgst_total ?? totals.sgst],
        ['IGST', totals.igst_total ?? totals.igst],
      ]
        .filter(([, m]) => m && Number(m.amount) !== 0)
        .map(([label, amount]) => ({ component_code: label, label, behaviour: 'added', rate: null, amount }))
  const charged = taxes.filter((tax) => tax.behaviour !== 'reverse_charge')
  const reverse = taxes.filter((tax) => tax.behaviour === 'reverse_charge')
  const roundOff = Number(totals.round_off?.amount || 0)
  const withheld = withholding.reduce((sum, item) => sum + Number(item.amount.amount), 0)

  return (
    <table style={{ maxWidth: 380, marginLeft: 'auto' }}>
      <tbody>
        {totals.subtotal && Number(totals.discount_total?.amount || 0) !== 0 && (
          <>
            <Row label="Subtotal">{formatMoney(totals.subtotal)}</Row>
            <Row label="Discount">− {formatMoney(totals.discount_total)}</Row>
          </>
        )}
        <Row label="Taxable value">{formatMoney(totals.taxable_total)}</Row>
        {charged.map((tax) => (
          <Row key={`${tax.component_code}-${tax.rate}`} label={`${tax.label}${tax.rate != null ? ` ${tax.rate}%` : ''}`}>
            {formatMoney(tax.amount)}
          </Row>
        ))}
        {roundOff !== 0 && <Row label="Round off">{formatMoney(totals.round_off)}</Row>}
        {extraRows}
        <Row label="Total" strong>{formatMoney(totals.grand_total)}</Row>
        {reverse.length > 0 && (
          <tr style={{ cursor: 'default' }}>
            <td colSpan={2} className="muted small">
              Payable by the customer on reverse charge:{' '}
              {reverse.map((tax) => `${tax.label} ${tax.rate}% ${formatMoney(tax.amount)}`).join(', ')}
            </td>
          </tr>
        )}
        {withholding.map((item) => (
          <Row key={item.section_code} label={`TDS the customer may withhold (${item.rate}%)`}>
            − {formatMoney(item.amount)}
          </Row>
        ))}
        {withheld > 0 && netReceivable && (
          <Row label="Expected in cash" strong>{formatMoney(netReceivable)}</Row>
        )}
      </tbody>
    </table>
  )
}

// The taxes on one line, e.g. "CGST 9% ₹90.00 · SGST 9% ₹90.00".
export function LineTaxes({ line }) {
  if (!line.taxes?.length) return <span className="muted">{Number(line.gst_rate) ? `${line.gst_rate}%` : 'No tax'}</span>
  return (
    <>
      {line.taxes.map((tax) => (
        <div key={tax.component_code} className={tax.behaviour === 'reverse_charge' ? 'muted' : undefined}>
          {tax.component_code} {tax.rate}% {formatMoney(tax.amount)}
          {tax.behaviour === 'reverse_charge' && ' (RCM)'}
        </div>
      ))}
    </>
  )
}

// Tax notes a document must carry ("Supply meant for export under LUT…", "Tax payable on reverse charge").
export function TaxNotes({ notes }) {
  if (!notes?.length) return null
  return (
    <div className="alert info" style={{ marginTop: 12 }}>
      {notes.map((note) => (
        <div key={note}>{note}</div>
      ))}
    </div>
  )
}
