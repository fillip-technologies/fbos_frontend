import { useCallback, useEffect, useState } from 'react'
import { sessionsApi } from '@/features/sessions/api.js'
import SessionList from '@/features/sessions/components/SessionList.jsx'
import { describeDevice } from '@/features/sessions/utils.js'
import { friendlyMessage } from '@/shared/api/errors.js'

// The signed-in user's own sessions, for the profile page.
export default function MySessions() {
  const [sessions, setSessions] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(null) // a session id, or 'others'
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    sessionsApi
      .listMine()
      .then((res) => {
        setSessions(res.data)
        setHasMore(Boolean(res.page?.has_more))
      })
      .catch(setError)
  }, [])
  useEffect(load, [load])

  async function signOut(key, request, message) {
    setError(null)
    setNotice('')
    setBusy(key)
    try {
      await request()
      setNotice(message)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const otherCount = sessions?.filter((s) => !s.current).length || 0

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>Where you're signed in</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Browsers and devices signed in to your account. Sign out any you don't recognize, then reset your password.
          </p>
        </div>
        {otherCount > 0 && (
          <button
            className="btn secondary"
            disabled={busy === 'others'}
            onClick={() => signOut('others', sessionsApi.revokeMyOthers, 'Signed out of every other browser and device.')}
          >
            {busy === 'others' ? 'Signing out…' : 'Sign out everywhere else'}
          </button>
        )}
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{friendlyMessage(error)}</div>}

      {sessions ? (
        <>
          <SessionList
            sessions={sessions}
            busyId={busy}
            emptyText="No active sessions."
            onSignOut={(s) => signOut(s.id, () => sessionsApi.revokeMine(s.id), `Signed out ${describeDevice(s.user_agent)}.`)}
          />
          {hasMore && <p className="muted small">Showing the 100 most recently used.</p>}
        </>
      ) : (
        !error && <p className="muted">Loading…</p>
      )}
    </div>
  )
}
