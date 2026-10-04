import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contractsApi } from '@/features/sales/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { CONTRACT_TYPES, humanize } from '@/features/sales/utils.js'

const STATUSES = ['pending_signature', 'active', 'completed', 'terminated', 'expired']

export default function Contracts() {
  const navigate = useNavigate()
  const { orgId, activeOrg } = useActiveOrg()
  const [contracts, setContracts] = useState([])
  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    if (!orgId) return
    setLoading(true)
    setError(null)
    contractsApi
      .list(orgId, { limit: 25, cursor, status })
      .then((res) => {
        setContracts(res.data)
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }
  useEffect(load, [orgId, cursor, status])

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Contracts</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Agreements made from accepted quotations in {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <OrgSwitcher onChange={resetPaging} />
      </div>

      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            resetPaging()
            setStatus(e.target.value)
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={load} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Value</th>
              <th>Period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="center-note">Loading…</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No contracts found.</td></tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)}>
                  <td className="mono">{c.contract_no}</td>
                  <td>{c.client.name}</td>
                  <td>{CONTRACT_TYPES[c.contract_type] || c.contract_type}</td>
                  <td>{formatMoney(c.total_value)}</td>
                  <td className="small">
                    {formatDate(c.start_date)}
                    {c.end_date && ` – ${formatDate(c.end_date)}`}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
