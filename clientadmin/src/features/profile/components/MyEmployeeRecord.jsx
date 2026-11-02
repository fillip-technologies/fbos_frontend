import { useEffect, useState } from 'react'
import { getMyBankAccounts, getMyOnboarding, getMyWorker } from '@/features/people/api.js'
import { DOC_STATUS_LABELS, formatDate, statusLabel } from '@/features/people/utils.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { friendlyMessage } from '@/shared/api/errors.js'

function Detail({ label, children }) {
  return (
    <div className="detail">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// The signed-in user's own employee file, view only. Hidden when they have no employee record.
export default function MyEmployeeRecord() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const worker = await getMyWorker()
        // The extras are best effort: a failure there must not hide the record itself.
        const [onboarding, banks] = await Promise.all([
          getMyOnboarding().catch(() => null),
          getMyBankAccounts().catch(() => []),
        ])
        if (live) setState({ worker, onboarding, banks: banks || [] })
      } catch (error) {
        if (live) setState(error?.status === 404 ? { none: true } : { error })
      }
    })()
    return () => { live = false }
  }, [])

  if (state.loading || state.none) return null
  if (state.error) return <div className="panel form-section"><div className="alert error" style={{ margin: 0 }}>{friendlyMessage(state.error)}</div></div>

  const { worker, onboarding, banks } = state
  const items = (onboarding?.items || []).filter((i) => i.kind !== 'bank')
  const cap = { textTransform: 'capitalize' }

  return (
    <>
      <div className="panel form-section">
        <h2>My employee record</h2>
        <p className="muted small" style={{ marginTop: 0 }}>View only. Ask HR to change anything here.</p>
        <div className="details-grid">
          <Detail label="Employee code">{worker.worker_code}</Detail>
          <Detail label="Designation">{worker.job_title || worker.designation}</Detail>
          <Detail label="Employment type"><span style={cap}>{statusLabel(worker.employment_type)}</span></Detail>
          <Detail label="Status"><span style={cap}>{statusLabel(worker.status)}</span></Detail>
          <Detail label="Manager">{worker.manager?.name}</Detail>
          <Detail label="Date of joining">{worker.date_of_joining && formatDate(worker.date_of_joining)}</Detail>
          <Detail label="Probation ends">{worker.probation_end_date && formatDate(worker.probation_end_date)}</Detail>
          <Detail label="Confirmation date">{worker.confirmation_date && formatDate(worker.confirmation_date)}</Detail>
          <Detail label="Work email">{worker.work_email}</Detail>
          <Detail label="Personal email">{worker.personal_email}</Detail>
          <Detail label="Phone">{worker.phone}</Detail>
          <Detail label="Date of birth">{worker.date_of_birth && formatDate(worker.date_of_birth)}</Detail>
          <Detail label="Gender"><span style={cap}>{worker.gender}</span></Detail>
          <Detail label="Blood group">{worker.blood_group}</Detail>
          <Detail label="Address">{worker.residential_address}</Detail>
          <Detail label="Emergency contact">
            {worker.emergency_contact_name &&
              `${worker.emergency_contact_name}${worker.emergency_contact_relation ? ` (${worker.emergency_contact_relation})` : ''}`}
          </Detail>
          <Detail label="Emergency phone">{worker.emergency_contact_phone}</Detail>
        </div>
      </div>

      {items.length > 0 && (
        <div className="panel form-section">
          <h2>My documents</h2>
          <table className="table-plain">
            <thead>
              <tr><th>Document</th><th>Number</th><th>Valid till</th><th>File</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.code}>
                  <td>{item.label}</td>
                  <td>{item.has_number ? <span className="id-number">{item.number_masked || 'Saved'}</span> : <span className="muted">—</span>}</td>
                  <td>{item.expires_on ? formatDate(item.expires_on) : <span className="muted">—</span>}</td>
                  <td>{item.file_name || <span className="muted">—</span>}</td>
                  <td><StatusBadge status={item.status} label={DOC_STATUS_LABELS[item.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {banks.length > 0 && (
        <div className="panel form-section">
          <h2>My bank accounts</h2>
          <table className="table-plain">
            <thead>
              <tr><th>Bank</th><th>Account</th><th>IFSC</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id}>
                  <td>{b.bank_name}{b.is_primary && <span className="muted small"> · primary</span>}</td>
                  <td className="id-number">{b.account_masked}</td>
                  <td>{b.ifsc}</td>
                  <td style={cap}>{b.account_type}</td>
                  <td style={cap}>{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
