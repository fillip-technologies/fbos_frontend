// Labels for security log entries (actions recorded by the identity service).

export const REFRESH_EVENT = 'identity.session.refreshed.v1'

const ACTION_LABELS = {
  login_succeeded: 'Signed in',
  mfa_login_succeeded: 'Signed in with two-factor',
  mfa_challenge_issued: 'Password accepted, two-factor code asked',
  login_failed: 'Sign-in failed',
  mfa_verify_failed: 'Wrong two-factor code',
  mfa_replay_detected: 'Two-factor code used twice',
  account_locked: 'Account locked after failed attempts',
  login_attempt_account_locked: 'Sign-in refused: account locked',
  session_refreshed: 'Session renewed',
  logout_revocation: 'Signed out',
  session_revoked: 'Signed out another session',
  sessions_revoked: 'Signed out everywhere else',
  session_revoked_by_admin: 'Session ended by an admin',
  sessions_revoked_by_admin: 'Signed out everywhere by an admin',
  token_theft_detected_family_revoked: 'Session cut off: stolen token suspected',
}

export const actionLabel = (action) => ACTION_LABELS[action] || action.replace(/_/g, ' ')

const REASONS = {
  INVALID_CREDENTIALS: 'wrong email or password',
  ACCOUNT_NOT_ACTIVE: 'account not active',
  ORGANIZATION_AMBIGUOUS: 'company code needed',
  REFRESH_TOKEN_REUSED: 'an old token was presented again',
  SUBSCRIPTION_EXPIRED: 'subscription not active',
}

// A short note from an entry's details: why it failed, how they signed in, how many sessions ended.
export function detailNote(details = {}) {
  if (details.reason) return REASONS[details.reason] || details.reason.toLowerCase().replace(/_/g, ' ')
  if (details.auth_method === 'mfa') return 'password and two-factor code'
  if (details.sessions) return `${details.sessions} ${details.sessions === 1 ? 'session' : 'sessions'}`
  return ''
}

// Result -> existing badge colours (green, red, red, grey).
export const STATUS_BADGES = { success: 'active', failed: 'expired', locked: 'suspended', revoked: 'inactive' }
export const STATUS_LABELS = { success: 'Success', failed: 'Failed', locked: 'Locked', revoked: 'Ended' }

// What to show. Session renewals happen every few minutes per open browser, so the
// default view leaves them out.
export const VIEWS = [
  { value: 'activity', label: 'Sign-ins and sign-outs', params: { exclude_event_type: REFRESH_EVENT } },
  { value: 'failed', label: 'Failed sign-ins', params: { status: 'failed' } },
  { value: 'locked', label: 'Account locks', params: { status: 'locked' } },
  { value: 'ended', label: 'Sign-outs and ended sessions', params: { event_type: 'identity.session.revoked.v1' } },
  { value: 'renewals', label: 'Session renewals', params: { event_type: REFRESH_EVENT } },
  { value: 'all', label: 'Everything', params: {} },
]
