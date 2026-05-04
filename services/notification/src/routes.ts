import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendEmail } from './mailer.js';

const NotifyBody = z.object({
  channel: z.enum(['email', 'slack', 'teams', 'in_app']),
  to: z.string(),
  template: z.string(),
  data: z.record(z.unknown()).default({}),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/notify', async (req, reply) => {
    const body = NotifyBody.parse(req.body);
    if (body.channel === 'email') {
      await sendEmail({ to: body.to, template: body.template, data: body.data });
      return reply.code(202).send({ accepted: true });
    }
    return reply.code(501).send({ error: 'channel_not_implemented', channel: body.channel });
  });
}
