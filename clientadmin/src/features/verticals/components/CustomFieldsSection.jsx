import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import CustomFieldInputs from '@/shared/components/CustomFieldInputs.jsx'

// "Customize this form", for whoever may change a form's custom fields. The form's code
// (features/verticals/forms.js) is passed in, so record forms don't load the forms registry.
export function CustomizeFormLink({ formCode }) {
  const { user } = useAuth()
  if (!hasAccess(user, ACCESS.editFormFields)) return null
  return <Link className="small" to={`/custom-fields/${formCode}`}>Customize this form</Link>
}

// A record form's custom fields (from useFormFields) under one heading. Shows nothing when the
// form has none and the user can't add any.
export default function CustomFieldsSection({ formCode, fields, values, onChange, errors = {}, idPrefix = 'cf' }) {
  const { user } = useAuth()
  if (!fields.length && !hasAccess(user, ACCESS.editFormFields)) return null
  return (
    <div className="subpanel">
      <div className="subpanel-head">
        <div className="subpanel-title">More details</div>
        <CustomizeFormLink formCode={formCode} />
      </div>
      {fields.length > 0 ? (
        <CustomFieldInputs fields={fields} values={values} onChange={onChange} errors={errors} idPrefix={idPrefix} />
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>This form has no custom fields yet.</p>
      )}
    </div>
  )
}
