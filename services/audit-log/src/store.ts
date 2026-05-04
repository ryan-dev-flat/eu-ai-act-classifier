import { createHash, randomUUID } from 'node:crypto';
import { getAuditPool, withTransaction } from '@eu-ai-act/db';

export interface AppendInput {
  tenantId: string;
  userId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Appends an event to the immutable audit log with a hash chain (architecture §4.3, §5.3).
 * The previous event's hash is read under transaction and combined with the new
 * payload to produce a tamper-evident hash chain.
 */
export async function appendEvent(input: AppendInput): Promise<{ eventId: string; hash: string }> {
  const pool = getAuditPool();
  return withTransaction(pool, async (client) => {
    const prev = await client.query<{ hash: string }>(
      'SELECT hash FROM audit_events WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 1 FOR UPDATE',
      [input.tenantId],
    );
    const prevHash = prev.rows[0]?.hash ?? null;
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();
    const hash = createHash('sha256')
      .update(JSON.stringify({ prevHash, eventId, timestamp, ...input }))
      .digest('hex');

    await client.query(
      `INSERT INTO audit_events
         (event_id, tenant_id, user_id, event_type, entity_type, entity_id, payload, timestamp, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        eventId,
        input.tenantId,
        input.userId,
        input.eventType,
        input.entityType,
        input.entityId,
        input.payload,
        timestamp,
        prevHash,
        hash,
      ],
    );

    return { eventId, hash };
  });
}
