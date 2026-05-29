import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway } from './app.js';
import type { Upstream } from './upstreams.js';

// ── Mock upstream server ──────────────────────────────────────────────────
// @fastify/http-proxy makes real HTTP calls even during app.inject(), so we
// run a lightweight HTTP server on a random OS-assigned port.

let mockServer: http.Server;
let mockServerPort: number;
// Mutable bucket so tests can inspect which headers reached the upstream.
const capturedHeaders: { last: http.IncomingHttpHeaders } = { last: {} };

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        capturedHeaders.last = req.headers;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: req.url }));
      });
      mockServer.listen(0, '127.0.0.1', () => {
        mockServerPort = (mockServer.address() as { port: number }).port;
        resolve();
      });
    }),
);

afterAll(
  () => new Promise<void>((res, rej) => mockServer.close((e) => (e ? rej(e) : res()))),
);

// ── Helpers ───────────────────────────────────────────────────────────────

/** Minimal auth headers for devMode — tenant-a by default. */
const DEV_AUTH = {
  'x-tenant-id': 'tenant-a',
  'x-user-id': 'user-1',
  'x-roles': 'submitter',
};

/** Build a single-upstream gateway wired to the mock server. */
async function buildTestApp(rateLimitMax = 300) {
  const upstreams: readonly Upstream[] = [
    {
      prefix: '/v1/classifications',
      envVar: '',
      defaultUrl: `http://127.0.0.1:${mockServerPort}`,
      service: 'test-upstream',
    },
  ];
  const app = await buildGateway({
    upstreams,
    logger: false,
    devMode: true,
    corsOrigins: ['http://localhost:3000'],
    rateLimitMax,
    rateLimitWindow: '1 minute',
  });
  await app.ready();
  return app;
}

// ── Health endpoints ──────────────────────────────────────────────────────

describe('health probes', () => {
  it('GET /healthz returns 200 without auth', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'api-gateway' });
    await app.close();
  });

  it('GET /readyz returns 200 without auth', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

// ── Auth gate ─────────────────────────────────────────────────────────────

describe('auth gate', () => {
  it('rejects unauthenticated GET with 401', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/classifications' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'unauthorized' });
    await app.close();
  });

  it('rejects unauthenticated POST with 401', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      payload: { foo: 'bar' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('does NOT block OPTIONS preflight (CORS must pass through)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/classifications',
      headers: { origin: 'http://localhost:3000' },
    });
    // Must not be blocked by auth gate; CORS plugin handles the preflight.
    expect(res.statusCode).not.toBe(401);
    await app.close();
  });

  it('proxies authenticated requests to the upstream (200)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/classifications',
      headers: DEV_AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
});

// ── Header forwarding ─────────────────────────────────────────────────────

describe('header forwarding', () => {
  it('forwards x-request-id to the upstream', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'GET',
      url: '/v1/classifications',
      headers: { ...DEV_AUTH, 'x-request-id': 'trace-abc-123' },
    });
    expect(capturedHeaders.last['x-request-id']).toBe('trace-abc-123');
    await app.close();
  });

  it('forwards devMode identity headers to the upstream', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'GET',
      url: '/v1/classifications',
      headers: DEV_AUTH,
    });
    expect(capturedHeaders.last['x-tenant-id']).toBe('tenant-a');
    await app.close();
  });
});

// ── 404 for unknown routes ────────────────────────────────────────────────

describe('not-found handler', () => {
  it('returns 404 with JSON body for an unregistered prefix', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/unknown-resource',
      headers: DEV_AUTH,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'not_found' });
    await app.close();
  });
});

// ── Per-tenant rate limiting ──────────────────────────────────────────────

describe('rate limiting', () => {
  it('throttles a tenant after exceeding the window limit', async () => {
    const app = await buildTestApp(2); // max 2 requests / minute

    const req = (tenantId: string) =>
      app.inject({
        method: 'GET',
        url: '/v1/classifications',
        headers: { 'x-tenant-id': tenantId, 'x-user-id': 'u1', 'x-roles': 'submitter' },
      });

    // tenant-a: first two succeed; third is rate-limited
    expect((await req('tenant-a')).statusCode).toBe(200);
    expect((await req('tenant-a')).statusCode).toBe(200);
    const limited = await req('tenant-a');
    expect(limited.statusCode).toBe(429);
    // Verify the response is JSON and mentions the rate limit (message comes
    // from our errorResponseBuilder; exact `error` field is HTTP reason phrase).
    expect(limited.json()).toMatchObject({ message: expect.stringContaining('rate limit') });

    // tenant-b has its own counter and is not affected
    expect((await req('tenant-b')).statusCode).toBe(200);

    await app.close();
  });
});
