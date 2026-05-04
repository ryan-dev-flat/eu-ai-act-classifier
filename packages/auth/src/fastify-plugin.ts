import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@eu-ai-act/shared-types';
import { verifyToken, type AuthContext } from './index.js';

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

export interface AuthPluginOptions {
  /**
   * If true, allow `x-tenant-id` / `x-user-id` / `x-roles` headers to populate
   * the auth context without JWT verification. Intended for local dev only.
   * Defaults to `process.env.AUTH_DEV_MODE === 'true'`.
   */
  devMode?: boolean;

  /**
   * Routes that should be reachable without authentication (e.g. health probes).
   * Defaults to `/healthz`.
   */
  publicPaths?: string[];
}

/**
 * Registers a `preHandler` hook that populates `req.authContext` from a Bearer
 * JWT (production) or `x-tenant-id` + `x-user-id` headers (dev mode). Routes
 * MUST guard themselves with `requireAuth(req)` if they need a context — the
 * hook does not return 401 by itself so health endpoints and OPTIONS preflights
 * stay reachable.
 */
export async function registerAuth(
  app: FastifyInstance,
  options: AuthPluginOptions = {},
): Promise<void> {
  const devMode = options.devMode ?? process.env.AUTH_DEV_MODE === 'true';
  const publicPaths = new Set(options.publicPaths ?? ['/healthz']);

  app.addHook('preHandler', async (req) => {
    if (publicPaths.has(req.url) || req.url.startsWith('/healthz')) return;

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        req.authContext = await verifyToken(auth.slice('Bearer '.length).trim());
        return;
      } catch (err) {
        req.log.warn({ err }, 'JWT verification failed');
      }
    }

    if (devMode) {
      const tenantId = headerOf(req, 'x-tenant-id');
      const userId = headerOf(req, 'x-user-id');
      if (tenantId && userId) {
        const rolesHeader = headerOf(req, 'x-roles') ?? '';
        const roles = rolesHeader
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean) as UserRole[];
        req.authContext = {
          userId,
          tenantId,
          roles: roles.length ? roles : ['submitter'],
          privilege: [],
          raw: { sub: userId, tenant_id: tenantId },
        };
      }
    }
  });
}

function headerOf(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Replies 401 when no auth context is present and returns false. Returns true
 * when the context is populated. Use as the first line of any protected route.
 */
export function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): req is FastifyRequest & { authContext: AuthContext } {
  if (!req.authContext) {
    reply.code(401).send({ error: 'unauthorized', message: 'authentication required' });
    return false;
  }
  return true;
}

/**
 * Returns 403 when the auth context lacks any of the allowed roles. Caller is
 * expected to have already invoked `requireAuth`.
 */
export function requireRoles(
  req: FastifyRequest & { authContext: AuthContext },
  reply: FastifyReply,
  ...allowed: UserRole[]
): boolean {
  if (!req.authContext.roles.some((r) => allowed.includes(r))) {
    reply.code(403).send({ error: 'forbidden', message: `requires one of: ${allowed.join(', ')}` });
    return false;
  }
  return true;
}
