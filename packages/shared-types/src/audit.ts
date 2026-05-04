import { z } from 'zod';

export const AuditEventType = z.enum([
  'classification.submitted',
  'classification.evaluated',
  'classification.approved',
  'classification.rejected',
  'classification.reassessed',
  'workflow.task_created',
  'workflow.task_completed',
  'export.generated',
  'rule_set.published',
  'policy_overlay.changed',
  'user.login',
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

export const AuditEvent = z.object({
  eventId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  eventType: AuditEventType,
  entityType: z.string(),
  entityId: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  prevHash: z.string().nullable(),
  hash: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;
