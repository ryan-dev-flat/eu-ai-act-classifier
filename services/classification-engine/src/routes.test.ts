import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassificationIntake, ClassificationResult } from '@eu-ai-act/shared-types';
import type { AuditClient, AuditEventInput } from '@eu-ai-act/audit-client';
import type { WorkflowClient } from './workflow-client.js';

// Mock engine + repository before importing routes so the registered handlers
// pick up the mocks. Vitest hoists vi.mock() calls to the top of the file.
vi.mock('./engine.js', async () => {
  const actual = await vi.importActual<typeof import('./engine.js')>('./engine.js');
  return { ...actual, evaluate: vi.fn() };
});
vi.mock('./repository.js', () => ({
  persistClassification: vi.fn(async () => undefined),
  findClassificationById: vi.fn(async () => null),
}));

import { registerRoutes } from './routes.js';
import { registerAuth } from '@eu-ai-act/auth';
import { evaluate, OpaUnavailableError } from './engine.js';
import { findClassificationById, persistClassification } from './repository.js';

const authHeaders = {
  'x-tenant-id': '00000000-0000-0000-0000-000000000001',
  'x-user-id': '00000000-0000-0000-0000-000000000003',
  'x-roles': 'submitter',
};

const intake: ClassificationIntake = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  systemId: '00000000-0000-0000-0000-000000000002',
  pathway: 'standard',
  domain: 'hr_tech',
  templateId: 'standard-deployer',
  submitterId: '00000000-0000-0000-0000-000000000003',
  answers: [],
};

const baseResult: ClassificationResult = {
  classificationId: '11111111-1111-1111-1111-111111111111',
  riskTier: 'high_risk',
  obligations: ['art9_risk_management'],
  ruleSetVersion: 'v1',
  confidence: 1,
  openQuestions: [],
  rationale: 'Annex III(4) employment.',
  triggeredHighRiskReasons: [{ id: 'annex_iii_4', article: 'Annex III(4)', summary: 'Employment.' }],
  suppressedHighRiskReasons: [],
  evaluatedAt: '2025-01-15T10:00:00.000Z',
};

function inMemoryAudit(): AuditClient & { events: AuditEventInput[] } {
  const events: AuditEventInput[] = [];
  return {
    events,
    async write(event, _options) {
      events.push(event);
      return { eventId: 'evt-' + events.length, hash: 'h' + events.length };
    },
  };
}

function inMemoryWorkflow(): WorkflowClient & { calls: Array<{ classificationId: string; tier: string }> } {
  const calls: Array<{ classificationId: string; tier: string }> = [];
  return {
    calls,
    async createForResult(classificationId, result) {
      calls.push({ classificationId, tier: result.riskTier });
      return { workflowId: 'wf-' + (calls.length) };
    },
  };
}

async function buildApp(audit: AuditClient, workflow: WorkflowClient | null = null): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await registerAuth(app, { devMode: true });
  await registerRoutes(app, { audit, workflow });
  await app.ready();
  return app;
}

describe('classification-engine routes', () => {
  beforeEach(() => {
    vi.mocked(evaluate).mockReset();
    vi.mocked(persistClassification).mockReset();
    vi.mocked(findClassificationById).mockReset();
  });

  afterEach(() => vi.clearAllMocks());

  it('POST /v1/classifications persists, audits, and returns 201', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce(baseResult);
    vi.mocked(persistClassification).mockResolvedValueOnce(undefined);
    const audit = inMemoryAudit();
    const app = await buildApp(audit);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(baseResult);
    expect(persistClassification).toHaveBeenCalledWith(intake, baseResult, undefined);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      tenantId: intake.tenantId,
      userId: intake.submitterId,
      eventType: 'classification.evaluated',
      entityType: 'classification',
      entityId: baseResult.classificationId,
    });
    await app.close();
  });

  it('POST bootstraps a workflow for high-risk results', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce(baseResult);
    vi.mocked(persistClassification).mockResolvedValueOnce(undefined);
    const audit = inMemoryAudit();
    const workflow = inMemoryWorkflow();
    const app = await buildApp(audit, workflow);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(201);
    expect(workflow.calls).toEqual([
      { classificationId: baseResult.classificationId, tier: 'high_risk' },
    ]);
    await app.close();
  });

  it('POST does not bootstrap a workflow for limited-risk results', async () => {
    const limited: ClassificationResult = { ...baseResult, riskTier: 'limited_risk' };
    vi.mocked(evaluate).mockResolvedValueOnce(limited);
    vi.mocked(persistClassification).mockResolvedValueOnce(undefined);
    const workflow = inMemoryWorkflow();
    const app = await buildApp(inMemoryAudit(), workflow);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(201);
    expect(workflow.calls).toEqual([]);
    await app.close();
  });

  it('POST still returns 201 when workflow bootstrap fails', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce(baseResult);
    vi.mocked(persistClassification).mockResolvedValueOnce(undefined);
    const failing: WorkflowClient = {
      createForResult: vi.fn(async () => {
        throw new Error('workflow down');
      }),
    };
    const app = await buildApp(inMemoryAudit(), failing);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(201);
    expect(failing.createForResult).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('POST returns 502 when OPA is unavailable and does not persist', async () => {
    vi.mocked(evaluate).mockRejectedValueOnce(new OpaUnavailableError('http://opa', new Error('x')));
    const audit = inMemoryAudit();
    const app = await buildApp(audit);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'opa_unavailable' });
    expect(persistClassification).not.toHaveBeenCalled();
    expect(audit.events).toHaveLength(0);
    await app.close();
  });

  it('POST returns 502 audit_write_failed when audit-log rejects', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce(baseResult);
    vi.mocked(persistClassification).mockResolvedValueOnce(undefined);
    const audit: AuditClient = {
      write: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const app = await buildApp(audit);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/classifications',
      headers: authHeaders,
      payload: intake,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'audit_write_failed' });
    await app.close();
  });

  it('GET /v1/classifications/:id returns the persisted result', async () => {
    vi.mocked(findClassificationById).mockResolvedValueOnce(baseResult);
    const app = await buildApp(inMemoryAudit());

    const res = await app.inject({
      method: 'GET',
      url: `/v1/classifications/${baseResult.classificationId}`,
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(baseResult);
    expect(findClassificationById).toHaveBeenCalledWith(intake.tenantId, baseResult.classificationId, undefined);
    await app.close();
  });

  it('GET returns 401 when auth context is missing', async () => {
    const app = await buildApp(inMemoryAudit());
    const res = await app.inject({ method: 'GET', url: `/v1/classifications/${baseResult.classificationId}` });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'unauthorized' });
    await app.close();
  });

  it('GET returns 404 when the repository returns null', async () => {
    vi.mocked(findClassificationById).mockResolvedValueOnce(null);
    const app = await buildApp(inMemoryAudit());
    const res = await app.inject({
      method: 'GET',
      url: `/v1/classifications/${baseResult.classificationId}`,
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
