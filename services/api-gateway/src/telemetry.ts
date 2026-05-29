/**
 * OpenTelemetry SDK bootstrap for the API Gateway.
 *
 * Call `startTelemetry()` BEFORE any other module-level code in `index.ts` so
 * the SDK is registered as the global TracerProvider before Fastify creates its
 * first spans.
 *
 * No-ops gracefully when OTEL_EXPORTER_OTLP_ENDPOINT is unset, so local dev
 * without a collector works without changes.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let _sdk: NodeSDK | undefined;

export function startTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // No collector configured — run without tracing (local dev default).
    return;
  }

  _sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'api-gateway',
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
  });

  _sdk.start();

  // Flush pending spans on SIGTERM so the last batch is not lost.
  process.on('SIGTERM', () => {
    _sdk
      ?.shutdown()
      .catch((err) => console.error('[telemetry] shutdown error', err));
  });
}
