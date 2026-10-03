# FBOS — Client Admin Console

Vite + React 18 (plain JS) app for a **client administrator**: the person a platform admin
invites when creating a client. Runs on **http://localhost:5174**, next to `superadmin/` (:5173).

## What it does

- **Sign in** (`/auth/login`, optional organization code, MFA step). Only `user_type = client_admin`
  is accepted, mirroring the backend `require_client_admin` guard.
- **Accept invitation** (`/accept-invitation?token=…`) and **reset password** (`/reset-password?token=…`) —
  the pages the invitation / reset emails link to. **Forgot password** at `/forgot-password`.
- **Dashboard**: the client's service period (start → end, days left, expiring warning) and quotas,
  from `GET /clients/me`. These are set by the platform admin and are read-only here.
- **Organizations**: list, create (with optional first-admin invite), edit. The **fiscal year start
  (DD-MM, default `01-04`)** is owned and edited here, per organization.
- **Users** (`/users`, `/users/new`, `/users/:id`): list with search and status / unit / role filters;
  invite with full profile (phone, employee code, user type, home unit, manager) and **access**;
  user page with profile edit, resend invitation, deactivate (with hand-over), and the user's
  permissions (scope, source role, granted by / at) with an access editor.
- **Roles** (`/roles`): the role presets of an organization and their permissions; create custom
  roles and edit their permissions (the built-in `admin` role is read-only).
- **Org units** (`/org-units`, `/org-units/new`, `/org-units/:id`): the company → branch → department →
  team tree. Create (only valid parent types are offered: branch under company; department under
  company, branch or department; team under department), rename, set the head and working calendar,
  move a unit with everything below it (with a reason), and deactivate / reactivate. The unit page
  lists its sub-units and the people placed in it or below it.
- **Working calendars** (`/calendars`): create a calendar with timezone and weekly hours (several
  ranges per day for breaks), and edit its holiday list. Saving holidays replaces the whole list.
  The backend can't rename a calendar or change its hours after creation. A new sub-unit takes its
  parent's calendar unless another is picked.
- **My profile** (`/profile`, linked under your name in the sidebar): account details, "email me a
  password reset link", and two-factor sign-in setup (QR code drawn in the browser from the
  `otpauth_uri`, a manual key, confirm with the first code, then recovery codes shown once).
- **Organization switcher**: users, roles, org units and calendars work in one organization at a
  time, chosen at the top of the page and sent to the backend as `X-Organization-Id`.

### Access model (user-based)

Access is granted **per user**: each permission (`<service>.<entity>.<action>`) applies to the
whole organization or to one org unit and everything below it, optionally only to the user's own
records. Roles are **presets** — applying one copies its permissions onto the user, which can then be
adjusted individually. Changing a role later doesn't change users who already have it.
`src/features/access/components/AccessEditor.jsx` is the editor used by both the invite and the user page.

When the client's service period ends (or the client is suspended) every sign-in and API call is
rejected with `SUBSCRIPTION_EXPIRED`, and this app returns the user to the sign-in page.

## Access control

Navigation is driven by access rules, so what a user sees depends on who they are:

- `src/features/auth/access.js` — `hasAccess(user, rule)` and the `ACCESS` map (one rule per page, e.g.
  `{ permissions: ['identity.user.read'] }` or `{ userTypes: ['client_admin'] }`).
- `src/app/navigation.jsx` — the sidebar items, each with its `access` rule; items the user can't
  open are hidden.
- `src/features/auth/components/RequireAccess.jsx` — wraps each route in `App.jsx` with the same rule, so a
  typed URL shows "no access" instead of the page.

To add a page: add a rule to `ACCESS`, a sidebar entry in `NAV_ITEMS`, and a `<RequireAccess>` route.
Client administrators bypass permission checks (tenant superuser, like the backend's
`require_client_admin`); other user types are checked against `permissions` from `/auth/me`.
This is UX only — the backend still enforces every call.

## Run

```bash
cd clientadmin
npm install
npm run dev      # http://localhost:5174
npm run build
```

`/api/*` is proxied to the Identity service (`API_URL`, default `http://localhost:8001`).
Invitation / reset emails build their links from `CLIENT_ADMIN_BASE_URL` in the identity
service `.env` (default `http://localhost:5174`).

## Layout

```
src/
├── app/        # main.jsx, App.jsx (routes), navigation.jsx, layout/Layout.jsx, styles.css
├── features/   # each: pages/, components/, api.js, utils.js
│   ├── auth/ dashboard/ organizations/ users/ access/ org-units/ calendars/ profile/
└── shared/     # api/ (http, session, errors, paths, query), components/, utils/
```

`@` aliases `src/`. Access rules: `features/auth/access.js`, `app/navigation.jsx`,
`features/auth/components/RequireAccess.jsx`; the access editor is
`features/access/components/AccessEditor.jsx`.
