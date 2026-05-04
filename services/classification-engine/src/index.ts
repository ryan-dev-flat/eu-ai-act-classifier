import Fastify from 'fastify';
import { loadEnv } from '@eu-ai-act/config';
import { registerAuth } from '@eu-ai-act/auth';
import { registerRoutes } from './routes.js';

const env = loadEnv();
const port = Number(process.env.PORT_CLASSIFICATION ?? 4001);

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
});

app.get('/healthz', async () => ({ status: 'ok', service: 'classification-engine' }));

await registerAuth(app);
await registerRoutes(app);

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`classification-engine listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
