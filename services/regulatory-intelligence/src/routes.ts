import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contentDir = resolve(process.cwd(), 'content');

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(resolve(contentDir, file), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/regulations/obligations', async () =>
    loadJson('obligations.json', { obligations: [] }),
  );

  app.get('/v1/regulations/changelog', async () =>
    loadJson('regulatory-changelog.json', { changes: [] }),
  );

  app.get('/v1/regulations/enforcement-map', async () =>
    loadJson('enforcement-authorities.json', { authorities: [] }),
  );

  app.get('/v1/regulations/sandboxes', async () =>
    loadJson('sandboxes.json', { sandboxes: [] }),
  );

  app.get('/v1/regulations/gpai/code-of-practice', async () =>
    loadJson('gpai-code-of-practice.json', { content: null }),
  );
}
