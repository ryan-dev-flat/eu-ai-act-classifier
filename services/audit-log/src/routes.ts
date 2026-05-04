import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@eu-ai-act/auth';
import { appendEvent } from './store.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/audit/events', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as any;

    // Security: override tenantId with the verified claim from the token.
    const event = await appendEvent({
      ...body,
      tenantId: req.authContext.tenantId,
    });
    return reply.code(201).send(event);
  });

  app.get('/v1/audit/events', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  app.get<{ Params: { classification_id: string } }>(
    '/v1/audit/events/:classification_id',
    async (_req, reply) => reply.code(501).send({ error: 'not_implemented' }),
  );

  app.get('/v1/audit/export', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
}
