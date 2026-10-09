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
- `src/features/<feature>/` — `pages/`, `components/`, `api.js` (that feature's endpoints), `utils.js`. Features: superadmin → `auth`, `clients`; clientadmin → `auth`, `dashboard`, `organizations` (incl. `ActiveOrg` + `OrgSwitcher`), `users`, `access` (roles + `AccessEditor`), `org-units`, `calendars`, `verticals` (custom fields + vertical packs), `profile`, `sessions` (where people are signed in), `audit-log` (security log), `customers` (revenue: customers + contacts, client services, providers and categories), `sales` (revenue: leads → opportunities → quotations → contracts, offerings, activity timeline), `billing` (revenue: invoices + credit notes, payments + allocations, collections), `documents` (documents service: `DocumentPanel` for files attached to any record, document categories).
- `src/features/<feature>/` — `pages/`, `components/`, `api.js` (that feature's endpoints), `utils.js`. Features: superadmin → `auth`, `clients`; clientadmin → `auth`, `dashboard`, `organizations` (incl. `ActiveOrg` + `OrgSwitcher`), `users`, `access` (roles + `AccessEditor`), `org-units`, `calendars`, `verticals` (custom fields + vertical packs), `profile`, `sessions` (where people are signed in), `notifications` (in-app inbox: bell + page), `audit-log` (security log), `customers` (revenue: customers + contacts, client services, providers and categories), `sales` (revenue: leads → opportunities → quotations → contracts, offerings, activity timeline), `billing` (revenue: invoices + credit notes, payments + allocations, collections), `delivery` (delivery: projects with milestones, team, risks and change requests; tasks, time, handovers; workflows; delivery setup).
- `src/shared/` — `api/` (`http.js` fetch wrapper + `ApiError`, `session.js`, `errors.js`, `paths.js`, `query.js` pagination/org-scope helpers in clientadmin), `components/`, `utils/`.

`shared/` must not import from `features/` or `app/`. New endpoints go in the owning feature's `api.js`, not in `shared/api/http.js`. Below, "`api/client.js`" means `shared/api/http.js`, and the `*Api` objects live in each feature's `api.js`.

## Commands

```bash
cd superadmin   # or: cd portal
npm install
npm run dev        # Vite dev server (5173 / 5180)
npm run lint       # ESLint guard (eslint.config.js)
npm run build      # production build → dist/
npm run preview    # serve the built dist/
```

There is **no test runner**. `npm run lint` is a guard, not a style guide: it fails only on mistakes `vite build` lets through and that crash at runtime — a name used but never defined (`no-undef`), a component never imported (`react/jsx-no-undef`), a hook called conditionally (`react-hooks/rules-of-hooks`). CI (`.github/workflows/ci-cd.yml`) runs lint + build on every pull request to `main` and again before each deploy.

### Backend dependency

superadmin talks **only to the FBOS Identity service**, which serves `/api/identity/v1/*`. clientadmin also calls the **Revenue service** (`/api/revenue/v1/*`, :8002) for customers and client services; its Vite proxy sends `/api/revenue` to `REVENUE_URL` (default `http://localhost:8002`, or `API_URL` when that is set, e.g. the gateway). It also calls the **Documents service** (`/api/documents/v1/*`, :8005) through `/api/documents` → `DOCUMENTS_URL` (default `http://localhost:8005`, or `API_URL`); it authenticates the same way, and checks a record's access by asking the record's own service (permissions `document.read`, `document.upload`, `document.share`, `document.category.manage`). Uploads go from the browser straight to ImageKit with signed fields (`features/documents/api.js`), so that one `fetch` bypasses `http.js`. Revenue has no sessions of its own: it forwards each request's `Authorization` and `X-Organization-Id` to identity's internal `/internal/authz/actor`, so the same token, org switching and per-user permissions (`revenue.client.*`, `revenue.client_service.*`, `revenue.lead.*`, `revenue.opportunity.*`, `revenue.quotation.approve`, `revenue.contract.*`, `revenue.offering.*`, `revenue.activity.*`, `revenue.invoice.*`, `revenue.payment.*`, `revenue.collection.*`) apply, and its errors use the `{ detail: { code, message } }` shape. The Vite dev server proxies same-origin `/api/*` to it (the backend ships no CORS, so calls must be same-origin — and the portal's refresh cookie only works same-origin). The proxy target is the **`API_URL`** env var, default **`http://localhost:8001`** (identity directly). The API gateway on `:8000` is optional and usually not running in local dev; set `API_URL=http://localhost:8000` to route through it.
superadmin talks **only to the FBOS Identity service**, which serves `/api/identity/v1/*`. clientadmin also calls the **Revenue service** (`/api/revenue/v1/*`, :8002) for customers and client services; its Vite proxy sends `/api/revenue` to `REVENUE_URL` (default `http://localhost:8002`, or `API_URL` when that is set, e.g. the gateway). Revenue has no sessions of its own: it forwards each request's `Authorization` and `X-Organization-Id` to identity's internal `/internal/authz/actor`, so the same token, org switching and per-user permissions (`revenue.client.*`, `revenue.client_service.*`, `revenue.lead.*`, `revenue.opportunity.*`, `revenue.quotation.approve`, `revenue.contract.*`, `revenue.offering.*`, `revenue.activity.*`, `revenue.invoice.*`, `revenue.payment.*`, `revenue.collection.*`) apply, and its errors use the `{ detail: { code, message } }` shape. clientadmin also calls the **Communication service** (`/api/communication/v1/*`, :8006) for the signed-in user's in-app notifications (`features/notifications`: sidebar bell + `/notifications` page); its Vite proxy sends `/api/communication` to `COMMUNICATION_URL` (default `http://localhost:8006`, or `API_URL` when set). It authenticates the same way as revenue (identity's `/internal/authz/actor`); the inbox is personal, not per organization, and each item carries the `organization_id` it is about. Notifications are raised by other services on communication's `/internal/notifications` (revenue does it for lead/customer assignment, quotation approval and won deals). The unread count is polled every 60 s while the tab is visible, with `api.get(..., { background: true })` so it doesn't move `TopProgress`. clientadmin also calls the **Delivery service** (`/api/delivery/v1/*`, :8003) for projects (the backend's "work units"), tasks, time, handovers and workflows (`features/delivery`); its Vite proxy sends `/api/delivery` to `DELIVERY_URL` (default `http://localhost:8003`, or `API_URL` when set). It authenticates like revenue, with permissions `delivery.work_unit.*`, `delivery.change_request.approve`, `delivery.task.*` (`read` also lets the assignee work their own task), `delivery.time_entry.read`, `delivery.handover.*`, `delivery.template.manage`, `delivery.workflow.*` and `delivery.task.request` (the member preset's one write: ask another team for work). A `delivery.task.read` or `delivery.work_unit.read` grant with *own records only* (the access editor's switch) limits the person to their own tasks (assigned to them, theirs to review, or created by them) and projects (they manage, are on the team of, or have a task in); anyone else's answers 404. Identity's `/internal/authz/actor` names such codes in `own_records_only`. Unit scopes apply only once an admin turns on the `team_visibility` setting (otherwise Delivery treats them as the whole company). Then a task or project read held within units shows those units' work plus the person's own, and everyone whose read is limited also sees their teams' unassigned tasks. Delivery asks identity's `/internal/authz/actor?with_units=true` for `unit_scopes` (the units each code covers) and `member_unit_ids` (the units the person belongs to); `services/views.py` is the one place that decides. "My work" (the Tasks page's first tab) adds "Your teams' queue" from `/tasks?unassigned=true&my_teams=true`, and the Queue's pool defaults to the same. Delivery stores only ids for people, units, customers and verticals and answers with `name: null`; pages name them with `features/delivery/useDeliveryNames.js`, which shares the other pages' cached lookups. Delivery settings (`GET`/`PATCH /settings`, `delivery.template.manage`, the panel on the Task types page) are each off until an admin turns them on. With `team_assignment_only` on, a task is assigned, taken from the queue or accepted from a handover only by someone who belongs to its team (identity's `/internal/people`: home unit at or below the team, or a current extra team member), else `ASSIGNEE_NOT_IN_UNIT`; `TEAM_MEMBERS_UNAVAILABLE` (503) when identity can't answer. Assign forms list people from `/assignable-people?unit_id=` (`useAssignablePeople` + `AssigneeOptions`), which task or handover managers may call without `identity.user.read`. Routing rules (`/routing-rules`, a panel on the Task types page) send a task type's or a discipline's work, optionally for one vertical, to a team; delivery picks the most specific active rule (type beats discipline, a vertical beats any vertical), and `/task-routing` answers it, so the new-task form fills in the team without working it out itself. With no rules nothing changes. A rule with `accepts_requests` lets anyone holding `delivery.task.request` ask that team for the work: `/requestable-types` lists what may be asked for (worked out by the same resolver), `POST /requests` creates the task unassigned in the team's queue (`source: 'request'`, the asker watches it), and `GET /requests` is "My requests" (`/requests` page). Assignment policies (`/assignment-policies`, read with `delivery.task.read`, set per unit with `delivery.template.manage`; a panel on the Task types page, `useAssignmentPolicies`) say how a team hands out work that reaches it unassigned (a new task without an assignee, a request, a handed-over task back in the queue, a follow-up whose person left): `queue` (the default, no row), `round_robin` or `least_busy`; delivery picks among identity's team members and leaves the task queued when it can't, and the task forms say what will happen. Delivery tells people about tasks through communication (assigned, ready for review, sent back, done or cancelled for whoever asked): an outbox row saved with each change, sent by a worker that runs only on the live server. With the `team_alerts` setting (third switch on the Task types page) it also warns about time limits close or missed, escalates to team heads (identity's `/internal/unit-heads`), and tells team heads about new requests and handovers. With the `working_hours` setting (fourth switch) time limits count working time on the team's calendar (identity's `/internal/work-calendars`: the team's own, else the nearest unit's above, else the company's; none = around the clock), and each clock says `working_hours: true`. Each task carries `custom_field_scope` (`{ unit_id, vertical_id }`: a project task takes the project's vertical, any other its team), which `useEffectiveTaskFields` uses. The Vite dev server proxies same-origin `/api/*` to it (the backend ships no CORS, so calls must be same-origin — and the portal's refresh cookie only works same-origin). The proxy target is the **`API_URL`** env var, default **`http://localhost:8001`** (identity directly). The API gateway on `:8000` is optional and usually not running in local dev; set `API_URL=http://localhost:8000` to route through it.

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

Plain-JS **Vite + React 18 + react-router-dom v6**. Data flow is a thin stack over `fetch`; there is no state-management library and no third-party data-fetching library. superadmin pages call the API modules directly and hold their own `useState`.

### Reading data in clientadmin (`src/shared/api/useQuery.js`)

clientadmin reads through a small in-house cache instead of `useEffect` + `useState`:

- `useQuery(key, ({ signal }) => xApi.list(orgId, params, { signal }), { enabled, staleTime, keepPrevious })` → `{ data, error, loading, refreshing, fetching, reload, setData }`. Keys are arrays, by convention `[resource, orgId, ...params]` (singular resource for one record: `['invoice', orgId, id]`, plural for lists: `['invoices', orgId, { status, cursor }]`).
- Cached data shows at once; data older than `staleTime` (30 s) refetches in the background (`fetching`) while its rows stay usable. Identical keys share one request; a request nobody waits for any more is aborted (read endpoints in each `api.js` take an optional last `{ signal }`).
- `keepPrevious` keeps the last rows on screen while the next page / tab / filter loads (`refreshing`: dim them and disable paging), never across organizations.
- `useLookup` is the same with a 5-minute `staleTime`, for catalogs (owners, roles, units, offerings, providers, verticals, calendars). Pages sharing a key must share the fetcher's error semantics: let the request fail and treat `error` as "not available" in the page, rather than `.catch(() => null)` in one place only.
- After a write: `setData(saved)` for the record on screen and `invalidate([resource, orgId])` for the lists it appears in (create pages invalidate their list before navigating). `prefetch(key, fn)` warms a detail record on row hover. Signing out clears the cache.
- Mutation errors stay in the page's own `error` state, separate from the query's `error`.
- Edit forms over a cached record use `useRecordForm(record, toForm)` (`shared/utils/`): saves diff against `toForm(base)` and send `base.version`, never the newer background copy, so they can't revert someone else's change.

Loading UI: `TableSkeleton` / `DetailSkeleton` / `PanelSkeleton` (`shared/components/Skeleton.jsx`, shown only after 200 ms), `.is-refreshing` on a panel whose rows are being replaced, `aria-busy={busy}` on submit buttons for a spinner, and one `TopProgress` bar for any request in flight (`shared/api/activity.js`). Pages are lazy routes (`app/pages.js` holds one import function per page; the sidebar preloads a section's pages on hover). GET requests are retried once on a network error / 429 / 503 / 504; writes never are.

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
- clientadmin: read with `useQuery` / `useLookup` (not `useEffect` + `fetch` state), show a skeleton instead of `Loading…`, and add new pages to `app/pages.js` as lazy routes.
- The backend has no defaults for an organization's `base_currency`, `fiscal_year_start`, `timezone` — forms must always send them. Client `contact_email` and organization `email` are required.

## Instructions for future work

- **Follow the source layout above.** New code goes in `src/features/<feature>/` (`pages/`, `components/`, `api.js`, `utils.js`); only feature-agnostic code goes in `src/shared/`. A new page also needs its route in `app/App.jsx` (and, in clientadmin, an `ACCESS` rule, a `NAV_ITEMS` entry and a `<RequireAccess>` wrapper).
- **Imports:** use the `@/` alias (`@/shared/api/errors.js`), not long `../../` chains. `shared/` never imports from `features/` or `app/`; avoid feature-to-feature imports except `auth` and `organizations` (and `sales`/`billing` → `customers`: they reuse the customer form, customer list, owners and money helpers; `customers` never imports them, and `sales` and `billing` link to each other by route only). Any feature may import `documents` (`DocumentPanel`, `DOCUMENT_SUBJECTS`) to attach files to its records; `documents` imports no other feature except `organizations`.
- **Imports:** use the `@/` alias (`@/shared/api/errors.js`), not long `../../` chains. `shared/` never imports from `features/` or `app/`; avoid feature-to-feature imports except `auth` and `organizations` (and `sales`/`billing`/`delivery` → `customers`: they reuse the customer form, customer list, owners and money helpers; `customers` never imports them, and `sales`, `billing` and `delivery` link to each other by route only).
- **Network:** every endpoint is added to the owning feature's `api.js` using `api` from `@/shared/api/http.js`; never call `fetch` from a component.
- **Backend rules:** read `server/.agents/AGENT_DEV.md` for the general code-quality principles (early returns, meaningful names, keep external API shapes at the boundary, useful errors, focused diffs); they apply to the frontend too.
- **Permissions, every time:** any change to a backend service (`server/src/v1/*`) that adds or changes an endpoint also adds its permissions in the same piece of work, following `server/.agents/AGENT_PERMISSIONS.md`: authentication through Identity, `<service>.<entity>.<action>` codes in Identity's catalog, a guard on every route, tests. On this side, add the page or action's `ACCESS` rule (`features/auth/access.js`), the access editor's labels for new services and entities (`features/access/permissions.js`) and `FRIENDLY` copy for new error codes.
- **Keep the two apps in step:** `shared/api/session.js`, `errors.js` and `http.js` are near-identical copies; a fix in one usually belongs in the other.
- **Verify** with `npm run lint && npm run build` in the app you changed (there is no test runner).
- **Git:** never add Claude as co-author or any attribution line to commits or PR descriptions.

## Task system plan and status (approved 2026-10-08)

A long-term plan for tasks across many teams and domains, built phase by phase. Each phase: backend PR (`server/`, repo growth-fbos) merged and deployed first, checked on the live server, then the frontend PR. Migrations are additive; anything that changes how work flows sits behind a per-company Delivery setting (Task types page), off by default.

**Decisions (the user's):**
1. "Domain" = the team (org unit) does the work; vertical + discipline decide which team (routing rules).
2. People with "own records only" task access still see their own teams' unassigned queue.
3. Managers assign only inside the task's team; across teams only by handover.
4. Workflows: built-in templates per discipline; each company may copy and edit them (versioned).
5. Separating the production database from dev is a go-live item, not a blocker (dev and live share the Hostinger databases today: a local run or migration changes live data).
6. Anyone may ask other teams for work their routing rules take requests for (`delivery.task.request`, in the member preset).
7. Task time limits (SLAs) stay in Delivery (working hours from Identity's calendars, alerts by Delivery's worker); Control's SLA module isn't used for tasks.
8. Escalation: assignee → team head (`org_units.head_user_id`) → the head of the unit above (levels without a head skipped).

**Phases:** 0 stabilise → A foundation → B people and scope → C visibility, "My work" → D routing, requests, assign policies → E notifications, time limits, escalation, recurring runner → F a workflow per task type (stage status categories, one status writer, one workflow per task) → G Revenue activity link, reports, domain packs → H optional skill/capacity assignment.

**Done and live:**
- Phases 0, A, B, C and D (routing rules, requests and My requests; assignment policies).
- E1: task notifications. An outbox plus a worker, which runs only on the live server via `docker-compose.aapanel.yml`.
- E2a: time-limit alerts, escalation and team-head notices (the `team_alerts` switch).
- E2b: time limits in working hours.
  - Identity: `GET /internal/work-calendars`.
  - Delivery: `services/work_calendar.py`, `services/calendars.py`, the `working_hours` switch.
  - Website: the fourth switch, and a working-time note on the badge.
- E3: the recurring-task runner.
  - `services/rrules.py`: RFC 5545 rules via `python-dateutil`, in the rule's time zone. `UNTIL` may be in UTC or local time; rules repeating more often than hourly are refused.
  - `services/recurring.py`, run by the worker each round: one task per occurrence from the rule's template, given out by the team's assignment policy.
  - Each occurrence is made once: `next_run_at` moves with `WHERE next_run_at = <old>`.
  - Missed occurrences: only the latest, if under a day old. Rules end when their series is over.
  - There's no screen for recurring rules yet (API only: `POST/GET /recurring-task-rules`).

**F1, workflows task types follow (2026-10-09):**
- A company links a task type to one of its published task workflows: `PUT /task-types/{id}/workflow`, a picker on the Task types page. The link is stored per company in `task_type_workflows`.
- Every stage needs a status category (`open`, `in_progress`, `in_review`, `done`, `cancelled`), and end stages must be done or cancelled. A type whose tasks record outcomes can't be linked yet.
- A new task of a linked type (requests and recurring tasks too) starts the workflow (`governs_status`). Its stage sets the task's status, and a stage owned by another team moves the task to that team's queue.
- The task moves by `GET/POST /tasks/{id}/transitions`:
  - the assignee or a task manager moves it on; out of a review stage, the reviewer does;
  - start, submit and review answer `WORKFLOW_GOVERNS_STATUS`;
  - cancelling the task or its workflow ends both.
- Workflows started by hand on a task leave its status alone, as before.
- Code: `services/task_workflows.py`; the status helpers are in `services/tasks.py`. Migration `e7c2a5d8f3b1`.
- The task's version moves whenever its workflow moves it (from any route) or a step waits for approval.
- Work sent back from review tells the assignee, with the step's note.
- Backend live (PRs #46, #47). The website part: steps on the task page (with a note when leaving review), the type picker (it warns that a built-in type affects every new task of it), the stage in task lists, and the workflow panel refreshing the task.

**Next:** F2, ready-made task workflow templates a company installs (no workflow builder page exists yet), then F3, the builder.

**Open questions:** on the new-task form, should a project's own team beat a routing rule? Today the rule wins.

**Known gaps:** a due date set from a time limit isn't recalculated when the task is handed over to a team with another calendar, nor when the working-hours switch is turned on; the badge is.

**Testing the backend without touching the shared database:** run each service's tests in an offline container, e.g. `MSYS_NO_PATHCONV=1 docker run --rm --network none -v "D:/Fillip/Fbos_frontend/server/src/v1/03_delivery:/app" -w /app server-delivery python -m pytest -q -p no:cacheprovider tests`. Check migrations the same way against `DATABASE_URL=sqlite+aiosqlite:////tmp/m.db`: `alembic upgrade head`, `downgrade -1`, `upgrade head`, `alembic check`. Never print `.env` values or unfiltered `docker compose config`, which shows database passwords.
