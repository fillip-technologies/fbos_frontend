import { api } from '@/shared/api/http.js'
import { COMMUNICATION } from '@/shared/api/paths.js'
import { pageQuery } from '@/shared/api/query.js'

// ---------- The signed-in user's in-app notifications (communication service) ----------
// Personal, not per organization: a client admin hears about every company of their
// client, and each item carries the `organization_id` it is about.
export const notificationsApi = {
  // Newest first; `unread: true` lists only the unread ones.
  list: ({ unread, ...opts } = {}, { signal } = {}) =>
    api.get(`${COMMUNICATION}/inbox?${pageQuery({ ...opts, unread: unread ? 'true' : undefined })}`, { signal }),
  // { count, urgent }. Polled in the background, so it never moves the progress bar.
  unreadCount: ({ signal } = {}) => api.get(`${COMMUNICATION}/inbox/unread-count`, { signal, background: true }),
  markRead: (id) => api.post(`${COMMUNICATION}/inbox/${id}/read`),
  markUnread: (id) => api.post(`${COMMUNICATION}/inbox/${id}/unread`),
  archive: (id) => api.post(`${COMMUNICATION}/inbox/${id}/archive`),
  markAllRead: () => api.post(`${COMMUNICATION}/inbox/read-all`),
}
