// One switch per inventory page, so each can be rolled back to the Fixly web app on its
// own while the two run side by side. VITE_INVENTORY_PAGES is a comma list of page keys,
// or "all". Dev builds show every page; production shows none until it is set.
const raw = import.meta.env.VITE_INVENTORY_PAGES ?? (import.meta.env.DEV ? 'all' : '')
const enabled = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))

export const inventoryPageOn = (key) => enabled.has('all') || enabled.has(key)
