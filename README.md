# FBOS Frontend

Administrative web consoles for the FBOS platform, built with React and Vite.

## Applications

| Application | Port | Description |
| :--- | :--- | :--- |
| **[`superadmin`](./superadmin)** | `5173` | Platform Super-Admin console for onboarding clients, setting quotas, and managing platform tenants. |
| **[`clientadmin`](./clientadmin)** | `5174` | Client Admin console for managing client organizations, units, users, and role-based access. |

## Prerequisites

- **Node.js 18+** (required by Vite 5) and **npm**

## Quick Start

Each application is managed independently. Navigate to the desired application directory:

```bash
# Super Admin Console
cd superadmin
npm install
npm run dev
```

```bash
# Client Admin Console
cd clientadmin
npm install
npm run dev
```

## Production Build

```bash
npm run build     # outputs static files to dist/
npm run preview   # serves the built app locally for a final check
```

## Backend Configuration

During development, the Vite dev servers proxy `/api/*` calls to avoid CORS issues:

- **Default Proxy:** `http://localhost:8001` (Identity Service)
- **API Gateway (Optional):** Set the `API_URL` environment variable (e.g., `API_URL=http://localhost:8000`)

```bash
API_URL=http://localhost:8000 npm run dev
```

## Repository Structure

```text
fbos_frontend/
├── clientadmin/    # Client administrator portal (:5174)
├── superadmin/     # Platform super-administrator portal (:5173)
└── README.md
```

## Source Layout (both apps)

Each app uses the same feature-based structure under `src/`, with `@` aliased to `src/`
(e.g. `import { friendlyMessage } from '@/shared/api/errors.js'`):

```text
src/
├── app/          # Entry (main.jsx), routes (App.jsx), layout shell, navigation, global styles
├── features/     # One folder per domain feature; owns its pages, components, api.js, utils
│   └── <feature>/{pages,components,api.js,utils.js}
└── shared/       # Feature-agnostic code: api/ (http, session, errors), components/, utils/
```

Rules: features import from `shared/` (and, sparingly, from `auth`/`organizations`); `shared/`
never imports from `features/` or `app/`. All network calls live in a feature's `api.js`.
