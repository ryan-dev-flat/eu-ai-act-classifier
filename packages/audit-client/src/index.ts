import type { AuditEventType } from '@eu-ai-act/shared-types';

export interface AuditEventInput {
  tenantId: string;
  userId: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export interface AuditClient {
  /**
   * Synchronously writes an event to the audit log. Per architecture §3.7, this
   * MUST complete before the calling service acknowledges the user action
   * (write-ahead). Implementations are responsible for hash chaining.
   */
  write(
    event: AuditEventInput,
    options?: { token?: string },
  ): Promise<{ eventId: string; hash: string }>;
}

export interface HttpAuditClientOptions {
  /** Optional bearer-token provider. Omit while service-to-service auth is not wired. */
  getToken?: () => Promise<string>;
  /** Injectable fetch for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createHttpAuditClient(
  baseUrl: string,
  options: HttpAuditClientOptions | (() => Promise<string>) = {},
): AuditClient {
  const opts: HttpAuditClientOptions =
    typeof options === 'function' ? { getToken: options } : options;
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async write(event, callOpts) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const token = callOpts?.token ?? (opts.getToken ? await opts.getToken() : undefined);
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
      const res = await doFetch(`${baseUrl}/v1/audit/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        throw new Error(`Audit write failed: ${res.status} ${await res.text()}`);
      }
      return (await res.json()) as { eventId: string; hash: string };
    },
  };
}
