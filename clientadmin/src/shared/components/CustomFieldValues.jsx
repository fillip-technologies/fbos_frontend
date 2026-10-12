import { formatFieldValue, isEmpty } from '@/shared/utils/customFields.js'

// A record's custom field values as label / value pairs, in the form's order. Fields without
// a value are left out; with none at all this shows nothing.
export default function CustomFieldValues({ fields, attributes }) {
  const filled = fields.filter((field) => !isEmpty(attributes?.[field.key]))
  if (!filled.length) return null
  return (
    <div className="details-grid">
      {filled.map((field) => (
        <div key={field.key}>
          <div className="detail-label">{field.label}</div>
          <div className="detail-value">{formatFieldValue(field, attributes[field.key])}</div>
        </div>
      ))}
    </div>
  )
}
