# ADR 0001 — API Gateway authentication model

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** Platform / backend
- **Supersedes:** —
- **Superseded by:** —

## Context

The platform currently exposes 8 Fastify microservices (`classification-engine`,
`workflow`, `regulatory-intelligence`, `timeline`, `audit-log`, `notification`,
`tenant-identity`, `export`). Each service independently calls
`registerAuth(app)` from `@eu-ai-act/auth`, which:

- Verifies the `Authorization: Bearer <JWT>` against `JWT_JWKS_URL` (JWKS
  served by the tenant-identity / OIDC provider).
- Validates `iss` (`JWT_ISSUER`) and `aud` (`JWT_AUDIENCE`).
- Derives an `AuthContext = { userId, tenantId, roles, privilege, raw, token }`
  from `sub`, `tenant_id`, `roles`, `privilege` claims.
- Exposes a dev-only bypass (`AUTH_DEV_MODE`) that trusts
  `x-tenant-id` / `x-user-id` / `x-roles` headers.

We are introducing a public API gateway in front of these services
(`api.eu-ai-act.example.com`). The gateway must decide how end-user identity
crosses the gateway → service boundary. The choice is hard to reverse: it
shapes the auth code in every downstream service, the audit-log schema, and
the operational secret-management story.

## Decision

**The gateway will forward the verified end-user JWT unchanged in the
`Authorization` header to internal services. Internal services continue to
verify the JWT against the same JWKS.**

We refer to this as the "forwarded JWT" model.

The gateway is responsible for:

1. Verifying the JWT once at the edge (same `JWT_JWKS_URL` / `iss` / `aud`).
2. Enforcing rate limits, CORS, and request-id propagation.
3. Forwarding `Authorization`, `x-request-id`, and `x-forwarded-for` to the
   upstream service.
4. Rejecting unauthenticated requests at the edge (returning 401) for all
   non-public paths.

Internal services continue to call `registerAuth(app)` unchanged. The JWKS
client in `jose` caches keys in-memory, so the per-request cost is a local
signature verification, not a network round-trip.

## Alternatives considered

### A. Signed internal JWT (token translation)

The gateway verifies the end-user JWT, then mints a short-lived (~60 s)
internal JWT signed with a gateway-only key, forwards that to services.
Services verify against a _different_ JWKS / shared secret.

- **+** Gateway can downscope claims per-service (least privilege).
- **+** Internal tokens are unforgeable even if a service is reached
  directly (defence against VPC-internal abuse).
- **−** New crypto infrastructure: gateway signing key, key rotation, an
  internal JWKS endpoint or shared secret in every service.
- **−** Every service needs a second verification path (end-user JWT for
  service-to-service legacy calls, internal JWT from gateway). Or we cut
  over all service-to-service calls too, which is a much larger change.
- **−** Audit log loses the original `jti` unless we copy it forward as a
  claim — extra schema work.

### B. Trusted headers over mTLS

The gateway verifies the JWT, then forwards plain
`x-tenant-id` / `x-user-id` / `x-roles` headers. Services trust the headers
only when the TLS peer certificate is the gateway's.

- **+** Cheapest per-request cost (no service-side JWT verification).
- **+** Already partially implemented as the `AUTH_DEV_MODE` path.
- **−** Requires mTLS termination on every service, plus a service-mesh or
  manual cert distribution. Significant new operational surface.
- **−** A misconfigured ingress that bypasses mTLS would silently allow
  identity spoofing. The failure mode is invisible.
- **−** Loses the cryptographic binding between identity and request — bad
  for the audit log story (we want the original JWT `jti` recorded).

### C. Status quo (no gateway, clients hit services directly)

- **+** Zero new infrastructure.
- **−** Clients (Jira plugin, web app) must know 8 hostnames.
- **−** Cross-cutting concerns (rate limiting, request-id, CORS) must be
  re-implemented per service.
- **−** No single public contract surface.

## Consequences

### Positive

- Zero new crypto infrastructure. Reuses `@eu-ai-act/auth` and the existing
  JWKS endpoint.
- Defence in depth: services remain safe if a misconfigured ingress lets a
  request reach them directly without going through the gateway.
- Tenant binding (`tenant_id` claim) survives the hop with no translation
  logic. Audit-log entries reference the same `jti` end-to-end.
- The gateway stays thin: routing + rate limit + verification + forwarding.
  No business logic.

### Negative

- Token size on every internal hop (~1–2 KB). Acceptable for this domain.
- Per-service JWT verification cost remains (microseconds with cached JWKS).
- Cannot downscope claims per-service. If we ever need to (e.g. forbid
  `export` service from seeing the `roles` claim of a SuperAdmin), we must
  migrate to alternative A.
- JWT TTL is set by the OIDC provider, not the gateway. If end-user tokens
  are long-lived, an exfiltrated service-side log could replay them within
  the TTL. Mitigation: keep access-token TTL ≤ 15 minutes at the IdP.

### Migration path to signed internal JWT (if needed later)

1. Add gateway signing key + `INTERNAL_JWT_JWKS_URL` to `packages/config`.
2. Extend `@eu-ai-act/auth` to accept _either_ end-user JWT (current
   behaviour) _or_ internal JWT (new path). No call-site changes.
3. Switch gateway forwarding to mint internal JWTs.
4. Once all traffic is internal-JWT, remove the end-user JWT verification
   from services.

This path is purely additive in `@eu-ai-act/auth` and does not require
changing any of the 8 services in lockstep.

## Resolved decisions

- **JWKS caching policy in the gateway.** Use `jose`'s default 30 s cooldown
  with a startup pre-warm: call `getJwks()` (or equivalent) during the
  gateway's `onReady` hook so the first real request never blocks on a key
  fetch. Log a warning if the warm-up fails (degraded start, not a crash).
- **Rate-limit dimension.** Rate-limit per `tenant_id` claim (read from the
  verified JWT). The gateway's `preHandler` hook order is:
  1. JWT verification → populate `authContext`
  2. Rate-limit check (keyed on `authContext.tenantId`)
  3. Proxy to upstream service
     Fall back to per-IP limiting for unauthenticated paths (e.g. `/healthz`).
- **CORS allowlist.** Two allowed origins at launch:
  - Web app: `https://app.eu-ai-act.example.com`
  - Forge plugin: `https://*.atlassian.net` (Forge sandboxed iframe origin)
    The exact Atlassian pattern is confirmed in `apps/jira-plugin/manifest.yml`
    under `permissions.external.fetch.backend`; update the gateway env var
    `CORS_ORIGINS` if the manifest changes.
