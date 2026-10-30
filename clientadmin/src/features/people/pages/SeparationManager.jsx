import { useState, useEffect } from 'react'
import { getSeparations, updateClearance, calculateSettlement, finalizeExit } from '../api.js'
import { formatCurrency, formatDate, statusLabel, toList } from '../utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

export default function SeparationManager() {
  const [separations, setSeparations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      setSeparations(toList(await getSeparations()))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const act = async (action) => {
    try {
      setActionError(null)
      await action()
      loadData()
    } catch (err) {
      setActionError(err)
    }
  }

  const setClearance = (sepId, department, status) =>
    act(() => updateClearance(sepId, { department, status, remarks: `Marked ${status} in the clearance matrix` }))

  const handleFinalize = (sepId) => {
    if (!window.confirm('Finalize this exit? This turns off their login, releases their position seat and queues the relieving letter.')) return
    act(() => finalizeExit(sepId))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Offboarding</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Exits, department clearances and full-and-final settlement. Start an exit from an employee's profile.
          </p>
        </div>
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />
      <ErrorBanner error={actionError} />

      {loading ? (
        <div className="panel center-note">Loading offboarding cases...</div>
      ) : separations.length === 0 ? (
        <div className="panel center-note">No offboarding cases.</div>
      ) : (
        separations.map((sep) => (
          <div key={sep.id} className="panel case-card">
            <div className="case-head">
              <div>
                <h3>
                  <span className="mono">{sep.separation_code}</span>{' '}
                  <StatusBadge status={sep.status} label={statusLabel(sep.status)} />
                </h3>
                <div className="muted small">
                  Resigned {formatDate(sep.resignation_date)} · Last working day {formatDate(sep.agreed_lwd)} ·
                  Notice shortfall {sep.notice_shortfall_days} days
                </div>
              </div>
              <div className="row-actions">
                {sep.status === 'clearance_completed' && (
                  <button type="button" className="btn" onClick={() => act(() => calculateSettlement(sep.id))}>
                    Calculate settlement
                  </button>
                )}
                {sep.status === 'settled' && (
                  <button type="button" className="btn danger" onClick={() => handleFinalize(sep.id)}>
                    Finalize exit
                  </button>
                )}
              </div>
            </div>

            <div className="stat-label">Department clearances</div>
            <div className="clearance-grid">
              {(sep.clearances || []).map((cl) => (
                <div key={cl.id} className="clearance-item">
                  <div className="section-head" style={{ marginBottom: 0 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{cl.department.replace(/_/g, ' ')}</strong>
                    <StatusBadge status={cl.status} label={statusLabel(cl.status)} />
                  </div>
                  {cl.remarks && <div className="muted small">{cl.remarks}</div>}
                  {sep.status === 'clearance_pending' && cl.status !== 'cleared' && (
                    <div className="row-actions">
                      <button type="button" className="btn small-btn" onClick={() => setClearance(sep.id, cl.department, 'cleared')}>
                        Clear
                      </button>
                      <button
                        type="button"
                        className="btn danger-outline small-btn"
                        onClick={() => setClearance(sep.id, cl.department, 'blocked')}
                      >
                        Block
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {sep.settlement && (
              <div className="settlement-box">
                <div className="stat-label">Full and final settlement</div>
                <div className="settlement-grid">
                  <div>
                    <span className="stat-label">Encashable leave</span>
                    <strong>
                      {sep.settlement.encashable_leave_days} days ({formatCurrency(sep.settlement.encashable_leaves_amount)})
                    </strong>
                  </div>
                  <div>
                    <span className="stat-label">Notice shortfall</span>
                    <strong className="amount-neg">-{formatCurrency(sep.settlement.notice_shortfall_deduction)}</strong>
                  </div>
                  <div>
                    <span className="stat-label">Net payable</span>
                    <strong className="stat-value">{formatCurrency(sep.settlement.net_payable, sep.settlement.currency)}</strong>
                  </div>
                  <div>
                    <span className="stat-label">Settlement status</span>
                    <StatusBadge status={sep.settlement.status} label={statusLabel(sep.settlement.status)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
