import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { UserRole } from '@eu-ai-act/shared-types';

export { registerAuth, requireAuth, requireRoles, type AuthPluginOptions } from './fastify-plugin.js';

export interface AuthContext {
  userId: string;
  tenantId: string;
  roles: UserRole[];
  privilege: string[];
  raw: JWTPayload;
  /** The raw Bearer token used for the request. */
  token?: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const url = process.env.JWT_JWKS_URL;
    if (!url) throw new Error('JWT_JWKS_URL is not configured');
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
}

export async function verifyToken(token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  });
  if (typeof payload.sub !== 'string') throw new Error('Token missing subject');
  const tenantId = (payload as Record<string, unknown>).tenant_id;
  if (typeof tenantId !== 'string') throw new Error('Token missing tenant_id');
  const roles = ((payload as Record<string, unknown>).roles as UserRole[]) ?? [];
  const privilege = ((payload as Record<string, unknown>).privilege as string[]) ?? [];
  return { userId: payload.sub, tenantId, roles, privilege, raw: payload, token };
}

export function hasRole(ctx: AuthContext, ...allowed: UserRole[]): boolean {
  return ctx.roles.some((r) => allowed.includes(r));
}

export function requireRole(ctx: AuthContext, ...allowed: UserRole[]): void {
  if (!hasRole(ctx, ...allowed)) {
    const err = new Error('Forbidden') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
