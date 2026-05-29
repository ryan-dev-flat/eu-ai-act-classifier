/**
 * Routing table: maps public path prefixes to internal service URLs.
 *
 * Per ADR 0001, the gateway forwards the verified end-user JWT unchanged in
 * the `Authorization` header. Each entry below registers an `@fastify/http-proxy`
 * instance that proxies `<prefix>/*` to `<upstream><prefix>/*` (no rewrite),
 * so each downstream service "owns" its top-level resource path and the
 * existing service routes (`/v1/<resource>/...`) remain unchanged.
 */
export interface Upstream {
  /** Public path prefix served by the gateway (matches downstream prefix). */
  readonly prefix: string;
  /** Environment variable holding the upstream base URL. */
  readonly envVar: string;
  /** Default upstream URL for local dev when envVar is unset. */
  readonly defaultUrl: string;
  /** Logical service name (for logs and error responses). */
  readonly service: string;
}

export const UPSTREAMS: readonly Upstream[] = [
  {
    prefix: '/v1/classifications',
    envVar: 'CLASSIFICATION_URL',
    defaultUrl: 'http://localhost:4001',
    service: 'classification-engine',
  },
  {
    prefix: '/v1/workflows',
    envVar: 'WORKFLOW_URL',
    defaultUrl: 'http://localhost:4002',
    service: 'workflow',
  },
  {
    prefix: '/v1/obligations',
    envVar: 'REGULATORY_URL',
    defaultUrl: 'http://localhost:4003',
    service: 'regulatory-intelligence',
  },
  {
    prefix: '/v1/rule-versions',
    envVar: 'REGULATORY_URL',
    defaultUrl: 'http://localhost:4003',
    service: 'regulatory-intelligence',
  },
  {
    prefix: '/v1/timelines',
    envVar: 'TIMELINE_URL',
    defaultUrl: 'http://localhost:4004',
    service: 'timeline',
  },
  {
    prefix: '/v1/readiness',
    envVar: 'TIMELINE_URL',
    defaultUrl: 'http://localhost:4004',
    service: 'timeline',
  },
  {
    prefix: '/v1/audit-events',
    envVar: 'AUDIT_LOG_URL',
    defaultUrl: 'http://localhost:4005',
    service: 'audit-log',
  },
  {
    prefix: '/v1/notifications',
    envVar: 'NOTIFICATION_URL',
    defaultUrl: 'http://localhost:4006',
    service: 'notification',
  },
  {
    prefix: '/v1/tenants',
    envVar: 'TENANT_URL',
    defaultUrl: 'http://localhost:4007',
    service: 'tenant-identity',
  },
  {
    prefix: '/v1/users',
    envVar: 'TENANT_URL',
    defaultUrl: 'http://localhost:4007',
    service: 'tenant-identity',
  },
  {
    prefix: '/v1/exports',
    envVar: 'EXPORT_URL',
    defaultUrl: 'http://localhost:4008',
    service: 'export',
  },
] as const;

export function resolveUpstreamUrl(u: Upstream): string {
  return process.env[u.envVar] ?? u.defaultUrl;
}
