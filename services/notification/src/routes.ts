import type { FastifyInstance } from 'fastify';
import { DirectNotificationRequest, NotificationEvent, WorkflowTaskCreatedNotificationPayload } from '@eu-ai-act/shared-types';
import { requireAuth } from '@eu-ai-act/auth';
import { sendEmail } from './mailer.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/notify', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = DirectNotificationRequest.parse(req.body);
    if (body.channel === 'email') {
      await sendEmail({ to: body.to, template: body.template, data: body.data });
      return reply.code(202).send({ accepted: true });
    }
    return reply.code(501).send({ error: 'channel_not_implemented', channel: body.channel });
  });

  app.post('/internal/events', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const event = NotificationEvent.parse(req.body);
    if (event.eventType !== 'workflow.task_created') {
      return reply.code(202).send({ accepted: true, skipped: true });
    }

    const payload = WorkflowTaskCreatedNotificationPayload.parse({
      ...event.payload,
      workflowId: event.entityId,
    });
    const to = resolveWorkflowRecipient(payload.role, payload.assigneeEmail);
    await sendEmail({
      to,
      template: event.eventType,
      data: { ...payload, tenantId: event.tenantId, userId: event.userId, entityId: event.entityId },
    });
    return reply.code(202).send({ accepted: true, channel: 'email', to });
  });
}

function resolveWorkflowRecipient(role: string, explicit?: string): string {
  if (explicit) return explicit;
  const roleKey = `NOTIFY_REVIEWER_${role.toUpperCase()}_EMAIL`;
  return (
    process.env[roleKey] ??
    process.env.NOTIFY_REVIEWER_EMAIL ??
    'reviewers@local.eu-ai-act.dev'
  );
}
