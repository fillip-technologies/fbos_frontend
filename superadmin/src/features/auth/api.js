import { api } from '@/shared/api/http.js'
import { logoutSession, refreshSession } from '@/shared/api/session.js'
import { IDENTITY } from '@/shared/api/paths.js'

// ---------- Auth endpoints ----------
export const authApi = {
  // The super-admin lives in `platform_admins` and has its own login endpoint
  // (no organization code, no MFA). The refresh token arrives as an HttpOnly cookie.
  login: ({ email, password }) =>
    api.post(`${IDENTITY}/auth/platform/login`, { email, password }, { auth: false }),

  me: () => api.get(`${IDENTITY}/auth/me`),

  // Revokes this sign-in server-side (works even after the access token expired) and
  // signs every open tab out.
  logout: () => logoutSession(),

  // Restores a session from the refresh cookie (page load). Resolves with { access_token }.
  restore: () => refreshSession(),
}
