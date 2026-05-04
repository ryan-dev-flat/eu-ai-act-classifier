/**
 * Dev-only session helpers. The MVP runs the API gateway in `AUTH_DEV_MODE`
 * which accepts `x-tenant-id` / `x-user-id` / `x-roles` headers in lieu of a
 * verified JWT. Until tenant-identity is fully wired the Next middleware reads
 * these values from environment variables and injects them on every /api/*
 * request.
 *
 * Defaults match the seed tenant from `db/migrations/0001_init.sql` so a
 * freshly compose-up'd stack can post a classification end-to-end.
 */
export const DEFAULT_DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_DEV_USER_ID = '00000000-0000-0000-0000-000000000010';
export const DEFAULT_DEV_ROLES = 'submitter,reviewer';

export interface DevSession {
  tenantId: string;
  userId: string;
  roles: string;
}

export function readDevSession(): DevSession {
  return {
    tenantId: process.env.DEV_TENANT_ID ?? DEFAULT_DEV_TENANT_ID,
    userId: process.env.DEV_USER_ID ?? DEFAULT_DEV_USER_ID,
    roles: process.env.DEV_ROLES ?? DEFAULT_DEV_ROLES,
  };
}
