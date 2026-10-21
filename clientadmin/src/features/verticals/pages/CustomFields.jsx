import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { customFieldsApi } from '@/features/verticals/api.js'
import { FORM_GROUPS, FORMS } from '@/features/verticals/forms.js'
import { fieldCounts } from '@/features/verticals/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Custom fields: every form that can take extra fields. Pick one to set its fields; they
// show on the form as soon as they're saved.
export default function CustomFields() {
  const { orgId, activeOrg } = useActiveOrg()
  const live = useQuery(
    ['custom-fields', orgId, 'live'],
    ({ signal }) => customFieldsApi.list(orgId, { status: 'published' }, { signal }),
    { enabled: Boolean(orgId) }
  )
  const counts = useMemo(() => fieldCounts(live.data ?? []), [live.data])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Custom fields</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Pick a form and add the fields {activeOrg ? `“${activeOrg.name}”` : 'your company'} fills in on it. Saved fields show on
            the form at once.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
        </div>
      </div>

      <ErrorBanner error={live.error} onRetry={live.reload} />

      {FORM_GROUPS.map((group) => (
        <div key={group} className="panel role-card">
          <h2>{group}</h2>
          <div className="form-list">
            {FORMS.filter((form) => form.group === group).map((form) => (
              <div key={form.code} className="form-row">
                <div>
                  {form.ready ? (
                    <Link to={`/custom-fields/${form.code}`}><strong>{form.name}</strong></Link>
                  ) : (
                    <strong className="muted">{form.name}</strong>
                  )}
                  <div className="muted small">{form.screens}</div>
                </div>
                <FormStatus form={form} count={counts[form.code]} known={live.data !== undefined} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FormStatus({ form, count, known }) {
  if (!form.ready) return <span className="badge inactive">Coming soon</span>
  if (!known) return null
  return <span className="muted small">{count ? `${count} field${count === 1 ? '' : 's'}` : 'No fields yet'}</span>
}
