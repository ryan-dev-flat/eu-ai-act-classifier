import type { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/v1/timeline/system/:id', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  app.get('/v1/timeline/portfolio', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  app.get('/v1/timeline/report/aug2026', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  app.get('/v1/timeline/calendar', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
}
