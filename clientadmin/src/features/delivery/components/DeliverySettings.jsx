import { useState } from 'react'
import { setupApi } from '@/features/delivery/api.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// How the company runs its delivery. Each setting is off until it is turned on here, so
// turning one on is the moment its behaviour starts.
export default function DeliverySettings({ orgId }) {
  const { data: settings, error: loadError, reload, setData } = useQuery(
    ['delivery-settings', orgId],
    ({ signal }) => setupApi.settings(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function change(body) {
    setBusy(true)
    setError(null)
    try {
      setData(await setupApi.updateSettings(orgId, settings, body))
      // The assign forms offer other people now.
      invalidate(['assignable-people', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <ErrorBanner error={loadError} onRetry={reload} />
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Delivery settings</h2>
      <ErrorBanner error={error} onRetry={reload} />
      <label className="inline-check">
        <input
          type="checkbox"
          checked={settings.team_assignment_only}
          disabled={busy}
          aria-busy={busy}
          onChange={(e) => change({ team_assignment_only: e.target.checked })}
        />
        Give tasks only to people in the task’s team
      </label>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        When on, a task can be assigned, taken from the queue, or accepted from a handover only by someone who
        belongs to its team: their home unit is the team (or a unit below it), or they are an extra member of it.
        Reviewers can still be anyone.
      </p>
    </div>
  )
}
