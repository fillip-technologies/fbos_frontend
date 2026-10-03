# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent Vite apps live in subdirectories, not the repo root. Run npm commands from inside the one you are working on:

- **`superadmin/`** — platform super-admin console (:5173).
- **`clientadmin/`** — client-admin console (:5174): organizations, users, subscription view, plus the invitation / password-reset pages the emails link to. See `clientadmin/README.md`.

The rest of this file describes `superadmin/`; `clientadmin/` reuses the same `api/client.js` + `api/errors.js` + `auth/AuthContext.jsx` structure plus the same `api/session.js` (refresh cookie `fbos_rt` / CSRF `fbos_csrf`). clientadmin accepts any user with an organization; pages and actions are gated per user by `features/auth/access.js` (permissions and role presets from `/auth/me`).

## Source layout

Both apps share one feature-based layout; `@` is an alias for `src/`.

- `src/app/` — `main.jsx` (entry), `App.jsx` (routes), `layout/Layout.jsx`, `navigation.jsx` (clientadmin), `styles.css`.
- `src/features/<feature>/` — `pages/`, `components/`, `api.js` (that feature's endpoints), `utils.js`. Features: superadmin → `auth`, `clients`; clientadmin → `auth`, `dashboard`, `organizations` (incl. `ActiveOrg` + `OrgSwitcher`), `users`, `access` (roles + `AccessEditor`), `org-units`, `calendars`, `profile`.
- `src/shared/` — `api/` (`http.js` fetch wrapper + `ApiError`, `session.js`, `errors.js`, `paths.js`, `query.js` pagination/org-scope helpers in clientadmin), `components/`, `utils/`.

`shared/` must not import from `features/` or `app/`. New endpoints go in the owning feature's `api.js`, not in `shared/api/http.js`. Below, "`api/client.js`" means `shared/api/http.js`, and the `*Api` objects live in each feature's `api.js`.

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

Data flow is a thin stack over `fetch`; there is no state-management library or data-fetching library. Pages call the API modules directly and hold their own `useState`.

### Sessions and token refresh (`src/shared/api/session.js`)

Identical file in both apps, configured at the top of each `api/client.js`:

| | superadmin | clientadmin |
|---|---|---|
| Refresh | `POST /auth/platform/token/refresh` | `POST /auth/token/refresh` |
| Logout | `POST /auth/platform/logout` | `POST /auth/logout` |
| Cookies | `fbos_prt` + `fbos_pcsrf` | `fbos_rt` + `fbos_csrf` |

- **Tokens:** the access token (15 min) is kept in memory only. The refresh token (30 days, rotated on every use) is an HttpOnly cookie. The readable CSRF cookie is copied into `X-CSRF-Token`.
- **Single flight:** concurrent refresh callers share one call.
- **Cross-tab coordination:** refreshes across tabs are serialized with the Web Locks API. The backend treats a replayed rotated token as theft and revokes the sign-in, so two tabs must never refresh at once. New tokens and logouts are broadcast over a `BroadcastChannel`.
- **Proactive refresh** happens at 80% of `expires_in`, and when a sleeping tab becomes visible again.
- **Separate cookie names:** cookies are shared across ports on `localhost`, which is why the consoles use different names. Don't merge them.

### The three layers to understand

1. **`src/shared/api/http.js`** — the single fetch wrapper and the only place network calls originate.
   - Reads the access token from `api/session.js` (`getAccessToken`). The `request()` helper attaches the `Authorization`, `X-Request-Id`, `Accept` and `X-Client-Type: browser` headers.
   - `parseErrorBody()` normalizes the **four distinct error shapes** the Identity backend emits into one `ApiError { status, code, title, retryable, fieldErrors, details }`:
     - RFC 7807 problem (`code` top-level, `detail` is a string, optional `meta`) — most domain/gateway errors
     - FastAPI 422 validation (`detail` is an array of `{loc, msg}`) → synthesized `VALIDATION_ERROR` with per-field issues
     - Auth token error (`detail` is an object `{code, message, status}`) — 401s from `get_current_user`
     - Raw `HTTPException` (`detail` is a plain string)
   - Network/connection failures become `ApiError` with `code: 'NETWORK_ERROR'`, `retryable: true`.
   - A 401 on an authenticated call triggers one refresh via `api/session.js` and replays the request (same headers, so the same Idempotency-Key). Only if the refresh fails is the session ended.
   - Exposes `authApi` (`login`, `verifyMfa`, `me`, `logout`) and `clientsApi` (`list` with cursor pagination, `get`, `create`, `update`). `clientsApi.create` sends an `Idempotency-Key` header.

2. **`src/shared/api/errors.js`** — presentation of errors. `friendlyMessage(err)` maps backend `code` → human copy (the `FRIENDLY` catalog mirrors Identity's `exceptions.py`; in the portal an entry may be a function, e.g. quota errors read `details.meta.limit/current`), falling back to the backend message. `getFieldErrors(err)` turns `fieldErrors` into a `{ field: issue }` map for inline form errors; `isRetryable(err)` gates a "Retry" affordance.

3. **`src/features/auth/AuthContext.jsx`** — session lifecycle and the super-admin guard.
   - Holds no token itself. On load it calls `authApi.restore()` (a refresh using the HttpOnly cookie) and then `/auth/me`.
   - `/auth/me` is the source of truth: the session is accepted only if `user_type === 'platform_admin'`, otherwise it is ended (`NotSuperAdminError`). This mirrors the backend `require_platform_admin` gate client-side.
   - Subscribes to `onSessionChange` so a sign-out anywhere (this tab, another tab, or a dead refresh token) clears `user`; `App.jsx`'s `RequireAuth` route guard then redirects to `/login`.

### Routing

- **superadmin** — `/login` (public); behind `RequireAuth` + `Layout`: `/clients`, `/clients/new`, `/clients/:id`.
- **portal** — `/login` (public; `?as=organization` preselects the tab), `/accept-invitation` (public); behind `RequireAuth` + `Layout`, each group behind `RequireConsole`: client console `/organizations`, `/organizations/new`, `/organizations/:id`; organization portal `/overview`, `/members`. `/` redirects to the signed-in console's home.

## Conventions

- Plain JavaScript (`.jsx`), no TypeScript. React function components with hooks; no CSS framework — a single `src/app/styles.css` with semantic class names (`panel`, `btn`, `field`, `alert error`, etc.).
- **All network access goes through the `api/client.js` modules.** Add new endpoints to the `*Api` objects rather than calling `fetch` from a component, so error normalization, auth headers and token refresh stay centralized.
- Surface errors via `friendlyMessage`/`getFieldErrors` rather than showing raw `err.message`.
- The backend has no defaults for an organization's `base_currency`, `fiscal_year_start`, `timezone` — forms must always send them. Client `contact_email` and organization `email` are required.

## Instructions for future work

- **Follow the source layout above.** New code goes in `src/features/<feature>/` (`pages/`, `components/`, `api.js`, `utils.js`); only feature-agnostic code goes in `src/shared/`. A new page also needs its route in `app/App.jsx` (and, in clientadmin, an `ACCESS` rule, a `NAV_ITEMS` entry and a `<RequireAccess>` wrapper).
- **Imports:** use the `@/` alias (`@/shared/api/errors.js`), not long `../../` chains. `shared/` never imports from `features/` or `app/`; avoid feature-to-feature imports except `auth` and `organizations`.
- **Network:** every endpoint is added to the owning feature's `api.js` using `api` from `@/shared/api/http.js`; never call `fetch` from a component.
- **Backend rules:** read `../fbos_services/.agents/AGENT_DEV.md` for the general code-quality principles (early returns, meaningful names, keep external API shapes at the boundary, useful errors, focused diffs); they apply to the frontend too.
- **Keep the two apps in step:** `shared/api/session.js`, `errors.js` and `http.js` are near-identical copies; a fix in one usually belongs in the other.
- **Verify** with `npm run build` in the app you changed (there is no test runner or linter).
- **Git:** never add Claude as co-author or any attribution line to commits or PR descriptions.
