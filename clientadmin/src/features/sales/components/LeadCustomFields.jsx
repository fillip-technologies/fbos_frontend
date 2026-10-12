import { useState } from 'react'
import { leadsApi } from '@/features/sales/api.js'
import { CustomizeFormLink } from '@/features/verticals/components/CustomFieldsSection.jsx'
import useFormFields from '@/features/verticals/useFormFields.js'
import CustomFieldInputs from '@/shared/components/CustomFieldInputs.jsx'
import CustomFieldValues from '@/shared/components/CustomFieldValues.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { changedAttributes, checkFields, isEmpty, toFormValues } from '@/shared/utils/customFields.js'

// The company's custom fields on one lead: their values, and an edit form for whoever manages
// leads. An edit sends only the values that changed (an emptied one as null, which removes it).
export default function LeadCustomFields({ orgId, lead, canEdit, onSaved }) {
  const fields = useFormFields(orgId, 'revenue.lead', {
    verticalId: lead.vertical?.id,
    values: { source: lead.source, vertical_id: lead.vertical?.id },
  })
  const [values, setValues] = useState(null) // the edit form's values while editing
  const [problems, setProblems] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!fields.length) return null

  const filled = fields.some((field) => !isEmpty(lead.attributes?.[field.key]))
  const startEditing = () => {
    setValues(toFormValues(fields, lead.attributes))
    setProblems({})
    setError(null)
  }

  async function save(e) {
    e.preventDefault()
    const found = checkFields(fields, values)
    setProblems(found)
    if (Object.keys(found).length > 0) return
    const changes = changedAttributes(fields, values, lead.attributes)
    if (Object.keys(changes).length === 0) {
      setValues(null)
      return
    }
    setError(null)
    setBusy(true)
    try {
      onSaved(await leadsApi.update(orgId, lead.id, lead.version, { attributes: changes }))
      setValues(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <h2 style={{ fontSize: 15, margin: 0 }}>More details</h2>
        <span className="row-actions">
          <CustomizeFormLink formCode="revenue.lead" />
          {canEdit && !values && <button className="btn secondary small-btn" onClick={startEditing}>Edit</button>}
        </span>
      </div>
      {values ? (
        <form onSubmit={save}>
          <ErrorBanner error={error} />
          <CustomFieldInputs fields={fields} values={values} onChange={setValues} errors={problems} idPrefix="lead_cf" />
          <div className="row-actions">
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Save</button>
            <button className="btn secondary" type="button" onClick={() => setValues(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      ) : filled ? (
        <CustomFieldValues fields={fields} attributes={lead.attributes} />
      ) : (
        <p className="muted small" style={{ margin: 0 }}>Nothing filled in yet.</p>
      )}
    </div>
  )
}
