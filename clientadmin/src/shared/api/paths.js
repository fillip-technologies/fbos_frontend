// Base path of the Identity service. Same-origin: the Vite dev proxy / reverse proxy forwards `/api/*`.
export const IDENTITY = '/api/identity/v1'
// Base path of the Revenue service (customers, client services; later sales and billing).
export const REVENUE = '/api/revenue/v1'
// Base path of the Documents service: files attached to any record (quotations, contracts, ...).
export const DOCUMENTS = '/api/documents/v1'
// Base path of the Communication service (in-app notifications).
export const COMMUNICATION = '/api/communication/v1'
// Base path of the Delivery service (projects, tasks, time, handovers, workflows).
export const DELIVERY = '/api/delivery/v1'
// Base path of the Inventory service (the Fixly backend): devices, stock, transfers, service.
export const INVENTORY = '/api/inventory/v1'
// Base path of the Assets service: company fixed assets, hardware, licenses, custody, lifecycle.
export const ASSETS = '/api/assets/v1'

