# FBOS Frontend

Administrative web consoles for the FBOS platform, built with React and Vite.

## Applications

| Application | Port | Description |
| :--- | :--- | :--- |
| **[`superadmin`](./superadmin)** | `5173` | Platform Super-Admin console for onboarding clients, setting quotas, and managing platform tenants. |
| **[`clientadmin`](./clientadmin)** | `5174` | Client Admin console for managing client organizations, units, users, and role-based access. |

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
