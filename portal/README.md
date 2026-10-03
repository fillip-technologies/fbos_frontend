# FBOS Portal

Sign-in app for the people *inside* a client, next to the platform super-admin console (`../superadmin`).

- **Client sign-in** — client administrators (`user_type: client_admin`). Lands in the client console: list, create and edit the client's organizations.
- **Organization sign-in** — members of an organization, using the organization code + email + password. Lands in the organization portal: an overview (organization, your profile, roles and permissions) and the member list.
- **Accept invitation** (`/accept-invitation?token=…`) — invited users set their password here before they can sign in.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # production build → dist/
```

The dev server proxies same-origin `/api/*` to the Identity service — `API_URL`, default `http://localhost:8001` (see `.env.example`). Port 5180 keeps clear of superadmin (5173) and of the ports Vite picks automatically when 5173 is busy.

## Getting someone signed in

Invitation tokens are not emailed (the Identity service only logs its domain events), so fetch the token yourself and open `http://localhost:5180/accept-invitation?token=<token>`:

```bash
# from the backend repo (D:\Fillip\Fbos)
docker compose logs identity | grep invitation_token

# logs are lost when the container is recreated — the database always has it:
docker compose exec db mysql -uroot -pfbos_root_password fbos_identity -e \
  "SELECT u.email, c.invitation_token, c.invitation_token_expires_at FROM user_credentials c JOIN users u ON u.id = c.user_id WHERE c.invitation_token IS NOT NULL;"
```

Invitations expire after 72 hours. Who gets invited:

- A **client admin** — when the super-admin creates a client with an *Admin email* (superadmin app).
- An **organization admin** — when a client admin creates an organization with an *Admin email* (this app). They sign in with Organization sign-in and that organization's code.

## Sessions

`/auth/login` sets an HttpOnly refresh-token cookie (`fbos_rt`) and a readable CSRF cookie (`fbos_csrf`). The 15-minute access token is kept in memory only; after a reload, or when any call returns 401, `api/client.js` gets a new one from `/auth/token/refresh` with the `X-CSRF-Token` header. Only one refresh runs at a time: the backend treats a reused refresh token as theft and revokes the whole session.

Dev quirk: cookies are per host, not per port, so this app and superadmin share `localhost` cookies. Signing out of either app clears the cookies of both.
