# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent Vite apps, nothing at the repo root. Run npm commands inside the app's folder.

| App | Dev URL | Who signs in | What it does |
|---|---|---|---|
| **`superadmin/`** | http://localhost:5173 | The platform super-admin | **Clients** CRUD |
| **`portal/`** | http://localhost:5180 | Client admins (*Client* tab) and organization members (*Organization* tab) | Client console: **Organizations** CRUD. Organization portal: overview + members |

The apps share no code. `api/client.js`, `api/errors.js`, `components/ErrorBanner.jsx`, `components/StatusBadge.jsx` and `styles.css` started as copies — when fixing shared logic (error parsing, the fetch wrapper), fix it in both.

## Commands

```bash
cd superadmin   # or: cd portal
npm install
npm run dev        # Vite dev server (5173 / 5180)
npm run build      # production build → dist/
npm run preview    # serve the built dist/
```

There is **no test runner and no linter configured** — the only scripts are `dev`, `build`, `preview`. (A stray `eslint-disable` comment in superadmin's `AuthContext.jsx` is leftover; ESLint is not installed.)

### Backend dependency

Both apps talk **only to the FBOS Identity service**, which serves `/api/identity/v1/*`. The Vite dev server proxies same-origin `/api/*` to it (the backend ships no CORS, so calls must be same-origin — and the portal's refresh cookie only works same-origin). The proxy target is the **`API_URL`** env var, default **`http://localhost:8001`** (identity directly). The API gateway on `:8000` is optional and usually not running in local dev; set `API_URL=http://localhost:8000` to route through it.

```bash
# PowerShell — override the proxy target
$env:API_URL = "http://localhost:8000"; npm run dev
```

> Note: `superadmin/README.md` is stale on this point — it references `GATEWAY_URL` and `:8000`, but `vite.config.js` reads `API_URL` and defaults to `:8001`. Trust `vite.config.js`.

The production `preview`/`dist` builds have **no proxy** — they must be served behind a reverse proxy that routes `/api/*` to the backend.

## Authentication — the two apps differ

**superadmin** signs in with `POST /auth/platform/login` (`superadmin@fbos.platform` / `Password@123`, seeded). The super-admin lives in its own `platform_admins` table: no organization code, no MFA, no refresh token. The 15-minute access token is persisted in `localStorage` (`fbos_superadmin_session`); `/auth/me` on load is the source of truth and the session is kept only if `user_type === 'platform_admin'`. Any 401 clears the session.

**portal** signs in with `POST /auth/login` (users table). The *Organization* tab also sends `organization_code` (uppercased; the backend compares it exactly and answers `INVALID_CREDENTIALS` for a wrong code). Login may return `{ status: 'mfa_required', mfa_token }`, followed up with `/auth/mfa/verify`.
- Session: login sets an HttpOnly refresh cookie `fbos_rt` + readable CSRF cookie `fbos_csrf`. The access token stays **in memory only**; `localStorage` (`fbos_portal_console`) stores just which console was chosen (`client` | `organization`).
- After a reload, or when an authed call returns 401, `refreshSession()` in `api/client.js` calls `/auth/token/refresh` with `X-CSRF-Token`, then replays the call once. **Concurrent callers share one in-flight refresh** — the backend revokes the whole session family when a refresh token is reused, so two parallel refreshes (e.g. StrictMode's double effect) would sign the user out.
- `AuthContext.establish()` enforces the console: *Client* requires `user_type === 'client_admin'` (mirrors `require_client_admin`); *Organization* accepts any user with an organization. A mismatch calls `/auth/logout` (the session was already opened) and throws `WrongConsoleError`.
- Invited users have no password until they redeem the invitation token at `/accept-invitation?token=…`. Tokens are not emailed — they appear in the identity logs and in `user_credentials.invitation_token` (see `portal/README.md`).
- Dev quirk: cookies are per host, not per port — signing out of superadmin also clears the portal's session cookies.

## Architecture

Plain-JS **Vite + React 18 + react-router-dom v6**. Data flow is a thin stack over `fetch`; there is no state-management or data-fetching library. Pages call the API modules directly and hold their own `useState`.

### The three layers to understand (same shape in both apps)

1. **`src/api/client.js`** — the single fetch wrapper and the only place network calls originate.
   - Holds the access token in a module variable (`setAccessToken`/`getAccessToken`); `request()` attaches `Authorization`, `X-Request-Id`, and `Accept` headers.
   - `parseErrorBody()` normalizes the **four distinct error shapes** the Identity backend emits into one `ApiError { status, code, title, retryable, fieldErrors, details }`:
     - RFC 7807 problem (`code` top-level, `detail` is a string, optional `meta`) — most domain/gateway errors
     - FastAPI 422 validation (`detail` is an array of `{loc, msg}`) → synthesized `VALIDATION_ERROR` with per-field issues
     - Auth token error (`detail` is an object `{code, message, status}`) — 401s from `get_current_user`
     - Raw `HTTPException` (`detail` is a plain string)
   - Network/connection failures become `ApiError` with `code: 'NETWORK_ERROR'`, `retryable: true`.
   - superadmin: `authApi` (`login`, `me`, `logout`), `clientsApi` (`list`, `get`, `create`, `update`).
   - portal: `authApi` (`login`, `verifyMfa`, `acceptInvitation`, `me`, `logout`), `organizationsApi` (`list`, `get`, `create`, `update`), `usersApi` (`list`), plus `refreshSession()`. `create` calls send an `Idempotency-Key` header.

2. **`src/api/errors.js`** — presentation of errors. `friendlyMessage(err)` maps backend `code` → human copy (the `FRIENDLY` catalog mirrors Identity's `exceptions.py`; in the portal an entry may be a function, e.g. quota errors read `details.meta.limit/current`), falling back to the backend message. `getFieldErrors(err)` turns `fieldErrors` into a `{ field: issue }` map for inline form errors; `isRetryable(err)` gates a "Retry" affordance.

3. **`src/auth/AuthContext.jsx`** — session lifecycle and the access guard described above.

### Routing

- **superadmin** — `/login` (public); behind `RequireAuth` + `Layout`: `/clients`, `/clients/new`, `/clients/:id`.
- **portal** — `/login` (public; `?as=organization` preselects the tab), `/accept-invitation` (public); behind `RequireAuth` + `Layout`, each group behind `RequireConsole`: client console `/organizations`, `/organizations/new`, `/organizations/:id`; organization portal `/overview`, `/members`. `/` redirects to the signed-in console's home.

## Conventions

- Plain JavaScript (`.jsx`), no TypeScript. React function components with hooks; no CSS framework — a single `src/styles.css` with semantic class names (`panel`, `btn`, `field`, `alert error`, etc.).
- **All network access goes through the `api/client.js` modules.** Add new endpoints to the `*Api` objects rather than calling `fetch` from a component, so error normalization, auth headers and token refresh stay centralized.
- Surface errors via `friendlyMessage`/`getFieldErrors` rather than showing raw `err.message`.
- The backend has no defaults for an organization's `base_currency`, `fiscal_year_start`, `timezone` — forms must always send them. Client `contact_email` and organization `email` are required.
