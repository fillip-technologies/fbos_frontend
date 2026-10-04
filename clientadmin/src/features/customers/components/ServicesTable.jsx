import { Link } from 'react-router-dom'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { daysUntil, formatDate } from '@/shared/utils/format.js'
import { BILLING_CYCLES, MANAGED_BY, formatMoney } from '@/features/customers/utils.js'

const RENEWAL_WARNING_DAYS = 30

function Renewal({ service }) {
  if (!service.renewal_date) return <span className="muted">—</span>
  const days = daysUntil(service.renewal_date)
  const due = service.status === 'active' && days <= RENEWAL_WARNING_DAYS
  return (
    <>
      {formatDate(service.renewal_date)}
      {service.auto_renew && <div className="muted small">auto-renews</div>}
      {due && (
        <div>
          <span className={`badge ${days < 0 ? 'expired' : 'expiring'}`}>
            {days < 0 ? `overdue ${-days}d` : days === 0 ? 'today' : `in ${days}d`}
          </span>
        </div>
      )}
    </>
  )
}

// Outside services, for one customer or across all of them (`customerName` given).
export default function ServicesTable({ services, loading, customerName, onEdit, onDelete }) {
  const showCustomer = Boolean(customerName)
  const showActions = Boolean(onEdit || onDelete)
  const columns = 7 + (showCustomer ? 1 : 0) + (showActions ? 1 : 0)

  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            {showCustomer && <th>Customer</th>}
            <th>Provider</th>
            <th>Category</th>
            <th>Managed</th>
            <th>Renewal</th>
            <th>Cost</th>
            <th>Status</th>
            {showActions && <th />}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns} className="center-note">Loading…</td></tr>
          ) : services.length === 0 ? (
            <tr><td colSpan={columns} className="center-note">No services found.</td></tr>
          ) : (
            services.map((s) => (
              <tr key={s.id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.reference_no && <div className="muted small mono">{s.reference_no}</div>}
                </td>
                {showCustomer && (
                  <td>
                    <Link to={`/customers/${s.client_id}?tab=services`}>{customerName(s.client_id) || 'Customer'}</Link>
                  </td>
                )}
                <td>{s.provider.name}</td>
                <td>{s.category?.name || <span className="muted">—</span>}</td>
                <td>{MANAGED_BY[s.managed_by] || s.managed_by}</td>
                <td><Renewal service={s} /></td>
                <td>
                  {formatMoney(s.cost)}
                  {s.billing_cycle && <div className="muted small">{BILLING_CYCLES[s.billing_cycle] || s.billing_cycle}</div>}
                </td>
                <td><StatusBadge status={s.status} /></td>
                {showActions && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {onEdit && (
                      <button type="button" className="btn secondary small-btn" onClick={() => onEdit(s)}>Edit</button>
                    )}{' '}
                    {onDelete && (
                      <button type="button" className="btn danger-outline small-btn" onClick={() => onDelete(s)}>
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
