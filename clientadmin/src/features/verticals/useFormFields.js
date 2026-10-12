import { useMemo } from 'react'
import { formFieldsApi } from '@/features/verticals/api.js'
import { useLookup } from '@/shared/api/useQuery.js'
import { fieldsFromDefinitions, isShown } from '@/shared/utils/customFields.js'

// The custom fields a record form shows: the form's live fields kept for the record's
// vertical (or, without one, its team's verticals), less any whose rule hides it for
// `values`, the form's current input values under the names in features/verticals/forms.js.
// A failed read shows no custom fields.
export default function useFormFields(orgId, formCode, { verticalId, unitId, values } = {}) {
  const scope = verticalId ? `vertical:${verticalId}` : unitId ? `unit:${unitId}` : 'none'
  const { data } = useLookup(
    ['record-fields', orgId, formCode, scope],
    ({ signal }) => formFieldsApi.forRecord(orgId, formCode, { verticalId, unitId }, { signal }),
    { enabled: Boolean(orgId && formCode) }
  )
  const fields = useMemo(() => fieldsFromDefinitions(data ?? []), [data])
  return fields.filter((field) => isShown(field, values))
}
