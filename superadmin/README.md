# FBOS — Super Admin Console

A minimal **Vite + React (JavaScript)** frontend that connects **only** to the FBOS
platform *super-admin* process: platform-admin login and **Clients** management
(the endpoints gated behind `require_platform_admin` in the Identity service).

## What it does

- **Login** as the platform super-admin (`POST /api/identity/v1/auth/login`), with
  optional organization code and an MFA-challenge branch. Non-`platform_admin`
  accounts are rejected (mirrors the backend `require_platform_admin` check via `/auth/me`).
- **Clients CRUD** (`/api/identity/v1/clients`):
  - List with cursor pagination
  - Create (name, code, contact email, optional first client-admin invite, currency/timezone defaults, service start/end dates) — sends an `Idempotency-Key`
  - View + edit (name, contact email, status, quotas, service start/end via `PATCH`; "Renew +1 year" shortcut)
  - Delete a client (permanent; removes its organizations, users and credentials; confirm by typing the client code)
  - Fiscal year is **not** set here — the client admin owns it per organization (default `01-04`, DD-MM)
  - Outside the service window every client user is locked out (`SUBSCRIPTION_EXPIRED`)

Nothing else from the FBOS platform is wired in — this is the super-admin surface only.

## Prerequisites

The FBOS backend gateway must be running on `http://localhost:8000` (see the backend
repo's `docker compose up`). Seeded super-admin credentials:

```
Email:    superadmin@fbos.platform
Password: Password@123
```

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

The dev server proxies `/api/*` to the gateway (the gateway ships no CORS
middleware, so we call same-origin and let Vite forward). Point it elsewhere with:

```bash
# PowerShell
$env:GATEWAY_URL = "http://localhost:8000"; npm run dev
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview
```

> Note: the production `preview`/`dist` build has no proxy. Serve it behind a
> reverse proxy that routes `/api/*` to the gateway, or enable CORS on the gateway.

## Structure

```
src/
├── api/client.js          # fetch wrapper + auth/clients endpoints
├── auth/AuthContext.jsx   # token persistence + platform_admin guard
├── components/            # Layout, StatusBadge
└── pages/                 # Login, ClientsList, ClientCreate, ClientDetail
```
