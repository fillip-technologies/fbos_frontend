import { friendlyMessage, isRetryable } from '@/shared/api/errors.js'

// Consistent error surface across screens. Shows the friendly message and, when
// the failure is transient (503/504/429/network), an optional Retry button.
export default function ErrorBanner({ error, onRetry }) {
  if (!error) return null
  const message = friendlyMessage(error)
  const retryable = isRetryable(error)
  return (
    <div className="alert error" role="alert">
      <span>{message}</span>
      {retryable && onRetry && (
        <button type="button" className="btn secondary" style={{ marginLeft: 12 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
