import { Link } from 'react-router-dom'
import { INCOME_TYPES, money } from '@/features/finance/utils.js'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'

// Income entries, newest first; `showInvestment` adds the investment each came from.
export default function IncomeTable({ rows, loading, canWrite, onDelete, showInvestment = true }) {
  const cols = showInvestment ? 7 : 6
  return (
    <table>
      <thead>
        <tr>
          <th>Received</th><th>Kind</th>{showInvestment && <th>From</th>}<th>Description</th>
          <th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Tax deducted</th><th />
        </tr>
      </thead>
      <tbody>
        {loading ? <TableSkeleton cols={cols} /> : rows.length === 0 ? (
          <tr><td colSpan={cols} className="center-note">No income recorded.</td></tr>
        ) : (
          rows.map((n) => (
            <tr key={n.id}>
              <td>{formatDate(n.received_on)}</td>
              <td>{INCOME_TYPES[n.income_type] ?? n.income_type}</td>
              {showInvestment && <td>{n.investment_id ? <Link to={`/investments/${n.investment_id}`}>Investment</Link> : <span className="muted">—</span>}</td>}
              <td>{n.description ?? <span className="muted">—</span>}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{money(n.amount, n.currency)}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{money(n.tax_deducted, n.currency)}</td>
              <td>{canWrite && <button type="button" className="link-btn" onClick={() => onDelete(n)}>Delete</button>}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
