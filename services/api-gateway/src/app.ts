import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import { context, propagation, SpanKind, SpanStatusCode, trace, type Span } from '@opentelemetry/api';
import { registerAuth } from '@eu-ai-act/auth';
import { registerAuthGate } from './auth-gate.js';
import { UPSTREAMS, resolveUpstreamUrl, type Upstream } from './upstreams.js';

// Extend FastifyRequest so hooks can read/write the active span without casts.
// Use Span | null (not undefined) so decorateRequest(name, null) type-checks.
declare module 'fastify' {
  interface FastifyRequest {
    otelSpan: Span | null;
  }
}

export interface GatewayOptions {
  /** Override upstream routing table — useful for tests pointing to mock servers. */
  upstreams?: readonly Upstream[];
  /** Fastify logger config. Pass `false` to silence logs in tests. */
  logger?: boolean | object;
  /** CORS allowed origins. */
  corsOrigins?: string[];
  /** Rate-limit max requests per window (keyed on tenantId). */
  rateLimitMax?: number;
  /** Rate-limit time window (e.g. '1 minute' or ms as number). */
  rateLimitWindow?: string | number;
  /** Enable dev-mode auth (trust x-tenant-id / x-user-id headers). */
  devMode?: boolean;
}

/**
 * Builds and returns the Fastify gateway instance without starting the server.
 * Call `app.ready()` then `app.listen()` in the entry point.
 * Tests call `app.ready()` and use `app.inject()`.
 *
 * Hook order (per ADR 0001):
 *  preHandler A — registerAuth      → populates req.authContext
 *  preHandler B — rateLimit (hook:preHandler) → keyed on authContext.tenantId
 *  preHandler C — registerAuthGate  → 401 if no authContext
 */
export async function buildGateway(options: GatewayOptions = {}): Promise<FastifyInstance> {
  const {
    upstreams = UPSTREAMS,
    logger = { level: process.env.LOG_LEVEL ?? 'info' },
    corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300),
    rateLimitWindow = process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    devMode = process.env.AUTH_DEV_MODE === 'true',
  } = options;

  const app = Fastify({
    logger,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    disableRequestLogging: false,
  });

  // ── OpenTelemetry hooks ──────────────────────────────────────────────────
  // Decorate so TypeScript is satisfied without any `as any` casts.
  app.decorateRequest('otelSpan', null);

  const tracer = trace.getTracer('api-gateway', '0.1.0');

  // 1. Create a server span per request, extracting incoming W3C trace context.
  app.addHook('onRequest', (req, _reply, done) => {
    const parentCtx = propagation.extract(context.active(), req.headers);
    const span = tracer.startSpan(
      `${req.method} ${req.url}`,
      { kind: SpanKind.SERVER, attributes: { 'http.method': req.method, 'http.url': req.url, 'http.request_id': req.id } },
      parentCtx,
    );
    req.otelSpan = span;
    done();
  });

  // 2. Attach tenant/user identity once auth has run (preHandler order).
  app.addHook('preHandler', (req, _reply, done) => {
    if (req.otelSpan && req.authContext) {
      req.otelSpan.setAttribute('tenant.id', req.authContext.tenantId);
      if (req.authContext.userId) {
        req.otelSpan.setAttribute('user.id', req.authContext.userId);
      }
    }
    done();
  });

  // 3. Finish the span once the response is sent.
  app.addHook('onResponse', (req, reply, done) => {
    const span = req.otelSpan;
    if (span) {
      span.setAttribute('http.status_code', reply.statusCode);
      if (reply.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    }
    done();
  });
  // ────────────────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
  });

  // Auth MUST be registered before rateLimit so that authContext is populated
  // when the rate-limit preHandler hook fires (hook order within a lifecycle
  // is determined by registration order).
  await registerAuth(app, { devMode });

  await app.register(rateLimit, {
    hook: 'preHandler',
    max: rateLimitMax,
    timeWindow: rateLimitWindow,
    keyGenerator: (req) => req.authContext?.tenantId ?? req.ip,
    // errorResponseBuilder must return an Error — rate-limit throws the
    // return value, so a plain object would bypass statusCode detection
    // in setErrorHandler and produce a 500.
    errorResponseBuilder: (req, ctx) => {
      const err = Object.assign(
        new Error(`rate limit ${ctx.max} per ${ctx.after} exceeded`),
        { statusCode: 429, code: 'rate_limited', requestId: req.id },
      );
      return err;
    },
  });

  // Public probes — registered before auth-gate so they bypass the 401 check.
  app.get('/healthz', async () => ({ status: 'ok', service: 'api-gateway' }));
  app.get('/readyz', async () => ({ status: 'ok', service: 'api-gateway' }));

  // Edge 401 enforcement for all non-public, non-OPTIONS paths (ADR 0001).
  registerAuthGate(app);

  for (const upstream of upstreams) {
    const target = resolveUpstreamUrl(upstream);
    await app.register(httpProxy, {
      upstream: target,
      prefix: upstream.prefix,
      rewritePrefix: upstream.prefix,
      http2: false,
      replyOptions: {
        rewriteRequestHeaders: (req, headers) => {
          const outgoing: Record<string, string | string[] | undefined> = {
            ...headers,
            'x-request-id': req.id,
            'x-forwarded-host': req.hostname,
          };
          // Propagate W3C trace context (traceparent, tracestate) so the
          // upstream service can continue the same trace.
          if (req.otelSpan) {
            const ctx = trace.setSpan(context.active(), req.otelSpan);
            propagation.inject(ctx, outgoing as Record<string, string>);
          }
          return outgoing;
        },
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: 'not_found',
      message: `no route ${req.method} ${req.url}`,
      requestId: req.id,
    });
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500;
    req.log.error({ err, status }, 'gateway error');
    reply.code(status).send({
      error: err.code ?? 'internal_error',
      message: status >= 500 ? 'internal server error' : err.message,
      requestId: req.id,
    });
  });

  return app;
}
