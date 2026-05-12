import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireAuth } from '@eu-ai-act/auth';
import { z } from 'zod';

const contentDir = resolve(process.cwd(), 'content');

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(resolve(contentDir, file), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const ObligationsQuery = z.object({
  riskTier: z.string().optional(),
  role: z.string().optional(),
});

const EnforcementQuery = z.object({
  memberState: z.string().length(2).optional(),
  systemDomain: z.string().optional(),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { riskTier?: string; role?: string } }>(
    '/v1/regulations/obligations',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(req, reply)) return;
      const query = ObligationsQuery.safeParse(req.query);
      if (!query.success) {
        return reply.code(400).send({ error: 'invalid_query', details: query.error.flatten() });
      }
      const data = await loadJson<{ version: string; obligations: unknown[] }>('obligations.json', {
        version: 'v1',
        obligations: [],
      });
      let obligations = data.obligations;
      if (query.data.riskTier) {
        obligations = obligations.filter((o: any) => o.riskTiers?.includes(query.data.riskTier));
      }
      if (query.data.role) {
        obligations = obligations.filter((o: any) => o.appliesTo?.includes(query.data.role));
      }
      return { version: data.version, obligations };
    },
  );

  app.get('/v1/regulations/changelog', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return loadJson('regulatory-changelog.json', { version: 'v1', changes: [] });
  });

  app.get<{ Querystring: { memberState?: string; systemDomain?: string } }>(
    '/v1/regulations/enforcement-map',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(req, reply)) return;
      const query = EnforcementQuery.safeParse(req.query);
      if (!query.success) {
        return reply.code(400).send({ error: 'invalid_query', details: query.error.flatten() });
      }
      const data = await loadJson<{ version: string; authorities: unknown[] }>(
        'enforcement-authorities.json',
        { version: 'v1', authorities: [] },
      );
      let authorities = data.authorities;
      if (query.data.memberState) {
        authorities = authorities.filter(
          (a: any) => a.memberState === query.data.memberState,
        );
      }
      if (query.data.systemDomain) {
        authorities = authorities.filter(
          (a: any) => a.systemDomain === query.data.systemDomain,
        );
      }
      return { version: data.version, authorities };
    },
  );

  app.get('/v1/regulations/sandboxes', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return loadJson('sandboxes.json', { version: 'v1', sandboxes: [] });
  });

  app.get('/v1/regulations/gpai/code-of-practice', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return loadJson('gpai-code-of-practice.json', { version: 'v1', content: null });
  });
}
