import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sessionsApi } from '@/features/sessions/api.js'
import SessionList from '@/features/sessions/components/SessionList.jsx'
import { describeDevice } from '@/features/sessions/utils.js'
import { friendlyMessage } from '@/shared/api/errors.js'

// Another user's sessions, for the user page. `canSignOut` adds per-session and
// "everywhere" sign-out; `logLink` points to their entries in the security log.
export default function UserSessions({ orgId, user, canSignOut, logLink }) {
  const [sessions, setSessions] = useState(null)
  const [busy, setBusy] = useState(null) // a session id, or 'all'
  const [confirmAll, setConfirmAll] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    sessionsApi
      .listForUser(orgId, user.id)
      .then((res) => setSessions(res.data))
      .catch(setError)
  }, [orgId, user.id])
  useEffect(load, [load])

  async function signOut(key, request, message) {
    setError(null)
    setNotice('')
    setBusy(key)
    try {
      await request()
      setNotice(message)
      setConfirmAll(false)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>Sessions</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Where {user.name} is signed in. Signing out a session ends it at once.
          </p>
        </div>
        <div className="row-actions">
          {logLink && <Link className="btn secondary" to={logLink}>Security log</Link>}
          {canSignOut && sessions?.length > 0 && !confirmAll && (
            <button className="btn danger-outline" onClick={() => setConfirmAll(true)}>Sign out everywhere</button>
          )}
        </div>
      </div>

      {confirmAll && (
        <div className="inline-panel">
          <h3>Sign {user.name} out everywhere?</h3>
          <p className="muted small">
            All {sessions.length} {sessions.length === 1 ? 'session ends' : 'sessions end'} at once. They can sign in again with their
            password.
          </p>
          <div className="row-actions">
            <button
              className="btn danger"
              disabled={busy === 'all'}
              onClick={() => signOut('all', () => sessionsApi.revokeAllForUser(orgId, user.id), `${user.name} was signed out everywhere.`)}
            >
              {busy === 'all' ? 'Signing out…' : 'Sign out everywhere'}
            </button>
            <button className="btn secondary" onClick={() => setConfirmAll(false)}>Cancel</button>
          </div>
        </div>
      )}

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{friendlyMessage(error)}</div>}

      {sessions ? (
        <SessionList
          sessions={sessions}
          busyId={busy}
          emptyText={`${user.name} isn't signed in anywhere.`}
          onSignOut={
            canSignOut
              ? (s) => signOut(s.id, () => sessionsApi.revokeForUser(orgId, user.id, s.id), `Signed ${user.name} out of ${describeDevice(s.user_agent)}.`)
              : undefined
          }
        />
      ) : (
        !error && <p className="muted">Loading…</p>
      )}
    </div>
  )
}
