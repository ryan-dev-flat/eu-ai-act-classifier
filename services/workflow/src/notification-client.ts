import type { NotificationEvent } from '@eu-ai-act/shared-types';

export interface NotificationClient {
  publish(event: NotificationEvent, auth: ServiceAuth): Promise<void>;
}

export interface ServiceAuth {
  token?: string;
  tenantId: string;
  userId: string;
  roles?: string;
}

export function createHttpNotificationClient(baseUrl: string): NotificationClient {
  const root = baseUrl.replace(/\/$/, '');
  return {
    async publish(event, auth) {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...authHeaders(auth),
      };
      const res = await fetch(`${root}/internal/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`notification service returned ${res.status}: ${body}`);
      }
    },
  };
}

function authHeaders(auth: ServiceAuth): Record<string, string> {
  if (auth.token) return { authorization: `Bearer ${auth.token}` };
  return {
    'x-tenant-id': auth.tenantId,
    'x-user-id': auth.userId,
    'x-roles': auth.roles ?? 'admin',
  };
}
