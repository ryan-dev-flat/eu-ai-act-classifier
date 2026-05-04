import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ExportRequest = z.object({
  classificationId: z.string().uuid(),
  type: z.enum([
    'classification_memo',
    'aug2026_readiness',
    'compliance_workplan',
    'trust_badge',
    'risk_summary_card',
  ]),
  format: z.enum(['pdf', 'markdown']),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/exports', async (req, reply) => {
    ExportRequest.parse(req.body);
    return reply.code(501).send({ error: 'not_implemented' });
  });

  app.get<{ Params: { id: string } }>('/v1/exports/:id', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
}
