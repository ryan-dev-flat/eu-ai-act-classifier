import type { FastifyInstance } from 'fastify';

/**
 * Per ADR 0001, the gateway rejects unauthenticated requests at the edge for
 * all non-public paths. `@eu-ai-act/auth`'s `registerAuth` populates
 * `req.authContext` from the Bearer JWT but does NOT 401 on its own — that
 * responsibility is delegated to each downstream route. The gateway is the
 * edge boundary, so this hook makes the 401 explicit before any proxy fires.
 */
const PUBLIC_PATHS = new Set(['/healthz', '/readyz']);

export function registerAuthGate(app: FastifyInstance): void {
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_PATHS.has(req.url) || req.url.startsWith('/healthz')) return;
    if (req.method === 'OPTIONS') return;
    if (!req.authContext) {
      reply.code(401).send({
        error: 'unauthorized',
        message: 'authentication required',
        requestId: req.id,
      });
    }
  });
}
