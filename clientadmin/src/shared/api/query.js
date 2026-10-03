import { api } from '@/shared/api/http.js'

export function pageQuery({ limit = 25, cursor, ...rest } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  for (const [k, v] of Object.entries(rest)) if (v) params.set(k, v)
  return params.toString()
}

// A client admin may act in any organization of their client: org-scoped calls take the
// organization id and send it as `X-Organization-Id` (omitted -> the admin's own org).
export const inOrg = (orgId, headers = {}) => (orgId ? { ...headers, 'X-Organization-Id': orgId } : headers)

// Walks cursor pagination for small catalogs (units, roles, permissions).
export async function listAll(path, orgId, params = {}) {
  const items = []
  let cursor
  do {
    const page = await api.get(`${path}?${pageQuery({ limit: 100, cursor, ...params })}`, { headers: inOrg(orgId) })
    items.push(...page.data)
    cursor = page.page?.has_more ? page.page.next_cursor : null
  } while (cursor)
  return items
}
