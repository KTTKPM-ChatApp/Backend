export const INTERNAL_API = {
  REALTIME: {
    NOTIFY_MESSAGE: '/api/v1/internal/messages/notify',
    NOTIFY_MESSAGE_DELETED: '/api/v1/internal/messages/delete',
    NOTIFY_CONVERSATION: '/api/v1/internal/conversations/notify',
    SYSTEM_EVENT: '/api/v1/internal/events/system',
    USERS_ONLINE: '/api/v1/internal/users/online',
    STATS: '/api/v1/internal/stats/online-users',
  },
  AUTH: {
    USER_DETAIL: (id: string) => `/users/${id}`,
    USER_SEARCH: '/users/search',
    USER_ME: '/users/me',
  },
} as const;
