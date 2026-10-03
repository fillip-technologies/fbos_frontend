import { api } from '@/shared/api/http.js'
import { logoutSession, refreshSession } from '@/shared/api/session.js'
import { IDENTITY } from '@/shared/api/paths.js'

// ---------- Auth endpoints ----------
export const authApi = {
  // Client admins sign in through the regular user login. `organization_code` is only
  // needed when the same email exists in more than one organization.
  login: ({ email, password, organization_code }) => {
    const body = { email, password }
    if (organization_code) body.organization_code = organization_code
    return api.post(`${IDENTITY}/auth/login`, body, { auth: false })
  },

  verifyMfa: ({ mfa_token, code }) =>
    api.post(`${IDENTITY}/auth/mfa/verify`, { mfa_token, code }, { auth: false }),

  me: () => api.get(`${IDENTITY}/auth/me`),

  // Revokes this sign-in server-side (works even after the access token expired) and
  // signs every open tab out.
  logout: () => logoutSession(),

  // Restores a session from the refresh cookie (page load). Resolves with { access_token, user }.
  restore: () => refreshSession(),

  forgotPassword: ({ email, organization_code }) => {
    const body = { email }
    if (organization_code) body.organization_code = organization_code
    return api.post(`${IDENTITY}/auth/password/forgot`, body, { auth: false })
  },

  resetPassword: ({ token, new_password }) =>
    api.post(`${IDENTITY}/auth/password/reset`, { token, new_password }, { auth: false }),

  acceptInvitation: ({ token, password }) =>
    api.post(`${IDENTITY}/auth/invitations/accept`, { token, password }, { auth: false }),

  // Two-factor (TOTP) enrollment for the signed-in user. `startMfaEnrollment` returns
  // { otpauth_uri, expires_at }; confirming with the first app code returns { codes }
  // (one-time recovery codes, shown once).
  startMfaEnrollment: () => api.post(`${IDENTITY}/auth/mfa/enroll`),
  confirmMfaEnrollment: (code) => api.post(`${IDENTITY}/auth/mfa/enroll/confirm`, { code }),
}
