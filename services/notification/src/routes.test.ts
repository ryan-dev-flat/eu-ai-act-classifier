import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerAuth } from '@eu-ai-act/auth';
import { registerRoutes } from './routes.js';
import { sendEmail } from './mailer.js';

vi.mock('./mailer.js', () => ({
  sendEmail: vi.fn(async () => undefined),
}));

describe('notification routes', () => {
  it('sends an email for workflow.task_created events', async () => {
    const app = Fastify();
    await registerAuth(app, { devMode: true });
    await registerRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/events',
      headers: {
        'x-tenant-id': '00000000-0000-4000-8000-000000000001',
        'x-user-id': '00000000-0000-4000-8000-000000000002',
        'x-roles': 'admin',
      },
      payload: {
        tenantId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
        eventType: 'workflow.task_created',
        entityType: 'workflow',
        entityId: '00000000-0000-4000-8000-000000000003',
        payload: {
          classificationId: '00000000-0000-4000-8000-000000000004',
          workflowId: '00000000-0000-4000-8000-000000000003',
          taskId: '00000000-0000-4000-8000-000000000005',
          role: 'legal',
          chainDefinitionId: 'high-risk-default-v1',
          assigneeEmail: 'legal@example.test',
        },
      },
    });

    expect(res.statusCode).toBe(202);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'legal@example.test',
        template: 'workflow.task_created',
      }),
    );
    await app.close();
  });
});
