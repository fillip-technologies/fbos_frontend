# FBOS — Admin Console (clientadmin)

Vite + React 18 (plain JS) admin console for **every user of a client's organizations**. The
client administrator (the person a platform admin invites when creating a client) sees
everything; other users see only the pages and actions their permissions allow. Runs on
**http://localhost:5174**, next to `superadmin/` (:5173).

**Naming:** on screen an organization is called a **company**, and its org units (branches,
departments, teams) the **company structure**; a person's home unit shows as **"Works in"**.
The API, routes and code keep the original names (`organizations`, `org-units`, `home_unit_id`).

## What it does

- **Sign in** (`/auth/login`, optional organization code, MFA step). Any user who belongs to an
  organization can sign in (client admin, employee, contractor, client user). The platform
  super-admin has no organization and is pointed to the super-admin console.
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
- **Org units** (`/org-units`, `/org-units/new`, `/org-units/:id`): the branch → department → team
  tree. The organization itself is the company, so there is no company unit: branches sit directly
  under the organization (no parent), departments under a branch or another department, teams under
  a department. Create (only valid parent types are offered), rename, set the head and working
  calendar, move a department or team with everything below it (with a reason; branches stay at the
  top), and deactivate / reactivate. The unit page lists its sub-units and the people placed in it or
  below it.
- **Working calendars** (`/calendars`): create a calendar with timezone and weekly hours (several
  ranges per day for breaks), and edit its holiday list. Saving holidays replaces the whole list.
  The backend can't rename a calendar or change its hours after creation.
- **Organization calendar**: each organization picks one of its calendars as its own (organization
  page, or "Use for organization" on the calendars page; client admins). A new branch starts on it,
  a new sub-unit takes its parent's calendar unless another is picked, and when the organization
  calendar changes, units on the previous one (or on none) switch with it. It can be replaced, not
  removed.
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

- `src/features/auth/access.js` — `hasAccess(user, rule)`, `can(user, permission)`,
  `hasRole(user, roleCode)` and the `ACCESS` map (one rule per page or action). A rule combines
  any of these, and every condition present must hold:
  - `userTypes: [...]` — the user's type is one of these (e.g. `['client_admin']`)
  - `permissions: [...]` — holds **all** of these permission codes (user-based access)
  - `anyPermissions: [...]` — holds **at least one** of them
  - `roles: [...]` — has **at least one** of these role presets applied (`/auth/me` → `roles[].role_code`)
- `src/app/navigation.jsx` — the sidebar items, each with its `access` rule; items the user can't
  open are hidden.
- `src/features/auth/components/RequireAccess.jsx` — wraps each route in `App.jsx` with the same rule, so a
  typed URL shows "no access" instead of the page.

To add a page: add a rule to `ACCESS`, a sidebar entry in `NAV_ITEMS`, and a `<RequireAccess>` route.
To hide an action, check `hasAccess(user, ACCESS.someAction)` around its button (see the users,
roles, org-unit and calendar pages).

Who sees what:

| | Client admin | Other users |
|---|---|---|
| Dashboard (`/`) | Subscription period and quotas (`/clients/me`) | Home page with links to the areas they can open |
| Organizations, org switcher | Yes — works across all the client's organizations | No — always their own organization |
| Users, roles, org units, calendars | Everything | Per permission, e.g. `identity.user.read` to see users |
| My profile, two-factor setup | Yes | Yes |

Client administrators pass every permission and role check (tenant superuser, like the backend);
other users are checked against `permissions` and `roles` from `/auth/me`. Lists a user can't
read are loaded as empty rather than failing the page (`useAccessCatalog`). This is UX only —
the backend still enforces every call.

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
