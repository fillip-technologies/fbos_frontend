# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent Vite apps live in subdirectories, not the repo root. Run npm commands from inside the one you are working on:

- **`superadmin/`** — platform super-admin console (:5173).
- **`clientadmin/`** — client-admin console (:5174): organizations, users, subscription view, plus the invitation / password-reset pages the emails link to. See `clientadmin/README.md`.

The rest of this file describes `superadmin/`; `clientadmin/` reuses the same `api/client.js` + `api/errors.js` + `auth/AuthContext.jsx` structure plus the same `api/session.js` (refresh cookie `fbos_rt` / CSRF `fbos_csrf`, guard `user_type === 'client_admin'`).

## Commands

```bash
cd superadmin
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the built dist/
```

There is **no test runner and no linter configured** — the only scripts are `dev`, `build`, `preview`. (A stray `eslint-disable` comment in `AuthContext.jsx` is leftover; ESLint is not installed.)

### Backend dependency

This app talks **only to the FBOS Identity service**, which serves `/api/identity/v1/*`. The Vite dev server proxies same-origin `/api/*` to it (the backend ships no CORS, so calls must be same-origin). The proxy target is the **`API_URL`** env var, default **`http://localhost:8001`** (identity directly). The API gateway on `:8000` is optional and usually not running in local dev; set `API_URL=http://localhost:8000` to route through it.

```bash
# PowerShell — override the proxy target
$env:API_URL = "http://localhost:8000"; npm run dev
```

> Note: `superadmin/README.md` is stale on this point — it references `GATEWAY_URL` and `:8000`, but `vite.config.js` reads `API_URL` and defaults to `:8001`. Trust `vite.config.js`.

Seeded super-admin login: `superadmin@fbos.platform` / `Password@123`. Login resolves by email alone, so the organization code is optional (only needed when an email exists in multiple orgs → `ORGANIZATION_AMBIGUOUS`).

The production `preview`/`dist` build has **no proxy** — it must be served behind a reverse proxy that routes `/api/*` to the backend.

## Architecture

Plain-JS **Vite + React 18 + react-router-dom v6**. Deliberately narrow scope: the platform super-admin surface only — login plus **Clients** CRUD (the endpoints gated behind `require_platform_admin` in Identity). Nothing else from FBOS is wired in.

Data flow is a thin stack over `fetch`; there is no state-management library or data-fetching library. Pages call the API modules directly and hold their own `useState`.

### Sessions and token refresh (`src/api/session.js`)

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

1. **`src/api/client.js`** — the single fetch wrapper and the only place network calls originate.
   - Reads the access token from `api/session.js` (`getAccessToken`). The `request()` helper attaches the `Authorization`, `X-Request-Id`, `Accept` and `X-Client-Type: browser` headers.
   - `parseErrorBody()` normalizes the **four distinct error shapes** the Identity backend emits into one `ApiError { status, code, title, retryable, fieldErrors, details }`:
     - RFC 7807 problem (`code` top-level, `detail` is a string) — most domain/gateway errors
     - FastAPI 422 validation (`detail` is an array of `{loc, msg}`) → synthesized `VALIDATION_ERROR` with per-field issues
     - Auth token error (`detail` is an object `{code, message, status}`) — 401s from `get_current_user`
     - Raw `HTTPException` (`detail` is a plain string)
   - Network/connection failures become `ApiError` with `code: 'NETWORK_ERROR'`, `retryable: true`.
   - A 401 on an authenticated call triggers one refresh via `api/session.js` and replays the request (same headers, so the same Idempotency-Key). Only if the refresh fails is the session ended.
   - Exposes `authApi` (`login`, `verifyMfa`, `me`, `logout`) and `clientsApi` (`list` with cursor pagination, `get`, `create`, `update`). `clientsApi.create` sends an `Idempotency-Key` header.

2. **`src/api/errors.js`** — presentation of errors. `friendlyMessage(err)` maps backend `code` → human copy (the `FRIENDLY` catalog mirrors Identity's `exceptions.py`), falling back to the backend message. `getFieldErrors(err)` turns `fieldErrors` into a `{ field: issue }` map for inline form errors; `isRetryable(err)` gates a "Retry" affordance.

3. **`src/auth/AuthContext.jsx`** — session lifecycle and the super-admin guard.
   - Holds no token itself. On load it calls `authApi.restore()` (a refresh using the HttpOnly cookie) and then `/auth/me`.
   - `/auth/me` is the source of truth: the session is accepted only if `user_type === 'platform_admin'`, otherwise it is ended (`NotSuperAdminError`). This mirrors the backend `require_platform_admin` gate client-side.
   - Subscribes to `onSessionChange` so a sign-out anywhere (this tab, another tab, or a dead refresh token) clears `user`; `App.jsx`'s `RequireAuth` route guard then redirects to `/login`.

### Routing

`App.jsx` defines routes: `/login` (public) and, behind `RequireAuth` + `Layout`, `/clients`, `/clients/new`, `/clients/:id`. Login supports an MFA-challenge branch — `authApi.login` may return `{ status: 'mfa_required', mfa_token }`, which the `Login` page follows up with `authApi.verifyMfa`.

## Conventions

- Plain JavaScript (`.jsx`), no TypeScript. React function components with hooks; no CSS framework — a single `src/styles.css` with semantic class names (`panel`, `btn`, `field`, `alert error`, etc.).
- **All network access goes through the `api/client.js` modules.** Add new endpoints to `authApi`/`clientsApi` rather than calling `fetch` from a component, so error normalization and auth headers stay centralized.
- Surface errors via `friendlyMessage`/`getFieldErrors` rather than showing raw `err.message`.
