# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The actual application lives in the **`superadmin/`** subdirectory, not the repo root. Run all npm commands from `superadmin/`.

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

### The three layers to understand

1. **`src/api/client.js`** — the single fetch wrapper and the only place network calls originate.
   - Holds the access token in a module variable (`setAccessToken`/`getAccessToken`); the `request()` helper attaches `Authorization`, `X-Request-Id`, and `Accept` headers.
   - `parseErrorBody()` normalizes the **four distinct error shapes** the Identity backend emits into one `ApiError { status, code, title, retryable, fieldErrors, details }`:
     - RFC 7807 problem (`code` top-level, `detail` is a string) — most domain/gateway errors
     - FastAPI 422 validation (`detail` is an array of `{loc, msg}`) → synthesized `VALIDATION_ERROR` with per-field issues
     - Auth token error (`detail` is an object `{code, message, status}`) — 401s from `get_current_user`
     - Raw `HTTPException` (`detail` is a plain string)
   - Network/connection failures become `ApiError` with `code: 'NETWORK_ERROR'`, `retryable: true`.
   - A 401 on an authenticated call invokes the registered `onUnauthorized` handler (set by the auth layer) to tear down the session.
   - Exposes `authApi` (`login`, `verifyMfa`, `me`, `logout`) and `clientsApi` (`list` with cursor pagination, `get`, `create`, `update`). `clientsApi.create` sends an `Idempotency-Key` header.

2. **`src/api/errors.js`** — presentation of errors. `friendlyMessage(err)` maps backend `code` → human copy (the `FRIENDLY` catalog mirrors Identity's `exceptions.py`), falling back to the backend message. `getFieldErrors(err)` turns `fieldErrors` into a `{ field: issue }` map for inline form errors; `isRetryable(err)` gates a "Retry" affordance.

3. **`src/auth/AuthContext.jsx`** — session lifecycle and the super-admin guard.
   - Persists only the access token in `localStorage` under `fbos_superadmin_session`.
   - On load, rehydrates the token and calls `/auth/me` as the source of truth; the session is accepted only if `user_type === 'platform_admin'`, otherwise cleared (`NotSuperAdminError`). This mirrors the backend `require_platform_admin` gate client-side.
   - Registers the `onUnauthorized` handler so any 401 clears the session; `App.jsx`'s `RequireAuth` route guard then redirects to `/login`.

### Routing

`App.jsx` defines routes: `/login` (public) and, behind `RequireAuth` + `Layout`, `/clients`, `/clients/new`, `/clients/:id`. Login supports an MFA-challenge branch — `authApi.login` may return `{ status: 'mfa_required', mfa_token }`, which the `Login` page follows up with `authApi.verifyMfa`.

## Conventions

- Plain JavaScript (`.jsx`), no TypeScript. React function components with hooks; no CSS framework — a single `src/styles.css` with semantic class names (`panel`, `btn`, `field`, `alert error`, etc.).
- **All network access goes through the `api/client.js` modules.** Add new endpoints to `authApi`/`clientsApi` rather than calling `fetch` from a component, so error normalization and auth headers stay centralized.
- Surface errors via `friendlyMessage`/`getFieldErrors` rather than showing raw `err.message`.
