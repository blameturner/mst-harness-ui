export const DATA_LAYER_INFO: Record<string, { role: string; detail: string }> = {
  redis: {
    role: 'Cache / message bus',
    detail: 'Caches model responses and session state. Also used as a pub/sub bus for real-time events between services.',
  },
  postgres: {
    role: 'Primary database',
    detail: 'Stores conversations, messages, agent runs, and all persistent application data.',
  },
  nocodb: {
    role: 'Org / config store',
    detail: 'Provides a spreadsheet-like interface for managing organisation settings, user records, and configuration data.',
  },
  mysql: {
    role: 'NocoDB backend',
    detail: 'Backing database for the NocoDB instance.',
  },
};
