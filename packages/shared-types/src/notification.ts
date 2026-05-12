import { z } from 'zod';
import { AuditEventType } from './audit.js';

export const NotificationChannel = z.enum(['email', 'slack', 'teams', 'in_app']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const WorkflowTaskCreatedNotificationPayload = z.object({
  classificationId: z.string().uuid(),
  workflowId: z.string().uuid(),
  taskId: z.string().uuid(),
  role: z.string(),
  chainDefinitionId: z.string(),
  assigneeId: z.string().uuid().nullable().optional(),
  assigneeEmail: z.string().email().optional(),
});
export type WorkflowTaskCreatedNotificationPayload = z.infer<
  typeof WorkflowTaskCreatedNotificationPayload
>;

export const NotificationEvent = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  eventType: AuditEventType,
  entityType: z.string(),
  entityId: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});
export type NotificationEvent = z.infer<typeof NotificationEvent>;

export const DirectNotificationRequest = z.object({
  channel: NotificationChannel,
  to: z.string(),
  template: z.string(),
  data: z.record(z.unknown()).default({}),
});
export type DirectNotificationRequest = z.infer<typeof DirectNotificationRequest>;
