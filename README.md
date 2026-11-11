# FBOS Frontend (Fillip Technologies)

Administrative operating system web console for Fillip Technologies, built with React and Vite.

## Applications

| Application | Port | Description |
| :--- | :--- | :--- |
| **[`clientadmin`](./clientadmin)** | `5174` | Enterprise portal for Fillip Technologies: organizations/subsidiaries, units, users, roles, revenue, delivery, documents, and management. |

## Prerequisites

- **Node.js 18+** (required by Vite 5) and **npm**

## Quick Start

Navigate to the `clientadmin` application directory:

```bash
cd clientadmin
npm install
npm run dev
```

### Production Build

Build optimized static assets into `dist/` and preview them locally:

```bash
cd clientadmin
npm run build
npm run preview
```

## Backend Configuration

During development, the Vite dev server proxies `/api/*` calls to avoid CORS issues:

- **Default Proxy:** `http://localhost:8001` (Identity Service)
- **API Gateway (Optional):** Set the `API_URL` environment variable (e.g., `API_URL=http://localhost:8000`)

```bash
API_URL=http://localhost:8000 npm run dev
```

## Repository Structure

```text
fbos_frontend/
├── clientadmin/    # Fillip Technologies enterprise portal (:5174)
├── server/         # Backend microservices
└── README.md
```

## Source Layout

The app uses a feature-based structure under `src/`, with `@` aliased to `src/`
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
