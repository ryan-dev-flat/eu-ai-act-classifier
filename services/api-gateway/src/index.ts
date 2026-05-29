/**
 * Entry point — builds the gateway and starts the HTTP server.
 * All app-building logic lives in ./app.ts so that tests can import
 * buildGateway() without triggering process.exit or network I/O.
 *
 * Telemetry MUST be bootstrapped before the Fastify instance is created so
 * that the global TracerProvider is registered in time for the first request.
 */
import { startTelemetry } from './telemetry.js';
startTelemetry(); // synchronous — safe to call before other imports resolve

import { buildGateway } from './app.js';

const port = Number(process.env.PORT_GATEWAY ?? 4000);

const app = await buildGateway();

// JWKS pre-warm (ADR 0001 §Resolved decisions): call after buildGateway so
// the hook is registered before app.listen() calls app.ready() internally.
app.addHook('onReady', async () => {
  const jwksUrl = process.env.JWT_JWKS_URL;
  if (!jwksUrl) {
    app.log.warn('JWT_JWKS_URL not set — gateway will reject all JWT requests');
    return;
  }
  try {
    const res = await fetch(jwksUrl);
    if (!res.ok) {
      app.log.warn({ status: res.status, jwksUrl }, 'JWKS pre-warm returned non-2xx');
      return;
    }
    app.log.info({ jwksUrl }, 'JWKS pre-warm succeeded');
  } catch (err) {
    app.log.warn({ err, jwksUrl }, 'JWKS pre-warm failed (degraded start)');
  }
});

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`api-gateway listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
