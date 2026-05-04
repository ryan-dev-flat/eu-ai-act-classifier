import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@eu-ai-act/auth';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/tenants/me', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return {
      tenantId: req.authContext.tenantId,
      // For MVP, we just return the context data. Real implementation would
      // fetch metadata from the tenants table.
      name: `Tenant ${req.authContext.tenantId}`,
    };
  });

  app.get('/v1/users/me', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return {
      userId: req.authContext.userId,
      tenantId: req.authContext.tenantId,
      roles: req.authContext.roles,
      email: (req.authContext.raw as any).email ?? 'user@example.com',
    };
  });

  app.post('/v1/tenants', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  // SCIM 2.0 endpoints (architecture §6.6) — stubbed for MVP.
  app.get('/scim/v2/Users', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
  app.post('/scim/v2/Users', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
}
