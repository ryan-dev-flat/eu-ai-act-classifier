import { describe, expect, it, vi } from 'vitest';
import type { ClassificationIntake } from '@eu-ai-act/shared-types';
import { evaluate, OpaEvaluationError, OpaUnavailableError } from './engine.js';

const intake: ClassificationIntake = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  systemId: '00000000-0000-0000-0000-000000000002',
  pathway: 'standard',
  domain: 'hr_tech',
  templateId: 'standard-deployer',
  submitterId: '00000000-0000-0000-0000-000000000003',
  answers: [],
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('evaluate()', () => {
  it('maps OPA snake_case fields to camelCase ClassificationResult', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        result: {
          riskTier: 'high_risk',
          obligations: ['art9_risk_management', 'art13_transparency_to_deployers'],
          confidence: 1,
          rationale: 'Annex III(4) employment use case.',
          openQuestions: [],
          triggered_high_risk_reasons: [
            { id: 'annex_iii_4_employment', article: 'Annex III(4)', summary: 'Employment.' },
          ],
          suppressed_high_risk_reasons: [],
        },
      }),
    );

    const result = await evaluate(intake, {
      opaUrl: 'http://opa.test',
      ruleSetVersion: 'v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idGenerator: () => '11111111-1111-1111-1111-111111111111',
      now: () => new Date('2025-01-15T10:00:00.000Z'),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://opa.test/v1/data/eu_ai_act/classification',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: intake }),
      }),
    );
    expect(result).toEqual({
      classificationId: '11111111-1111-1111-1111-111111111111',
      riskTier: 'high_risk',
      obligations: ['art9_risk_management', 'art13_transparency_to_deployers'],
      ruleSetVersion: 'v1',
      confidence: 1,
      openQuestions: [],
      rationale: 'Annex III(4) employment use case.',
      triggeredHighRiskReasons: [
        { id: 'annex_iii_4_employment', article: 'Annex III(4)', summary: 'Employment.' },
      ],
      suppressedHighRiskReasons: [],
      evaluatedAt: '2025-01-15T10:00:00.000Z',
    });
  });

  it('applies zod defaults when OPA omits optional fields', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ result: { riskTier: 'minimal_risk' } }),
    );

    const result = await evaluate(intake, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idGenerator: () => '22222222-2222-2222-2222-222222222222',
    });

    expect(result.riskTier).toBe('minimal_risk');
    expect(result.obligations).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.rationale).toBe('');
    expect(result.openQuestions).toEqual([]);
    expect(result.triggeredHighRiskReasons).toEqual([]);
    expect(result.suppressedHighRiskReasons).toEqual([]);
  });

  it('throws OpaUnavailableError when fetch rejects (network/connection)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      evaluate(intake, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(OpaUnavailableError);
  });

  it('throws OpaEvaluationError when OPA returns non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('boom', { status: 500 }),
    );
    await expect(
      evaluate(intake, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ name: 'OpaEvaluationError', status: 500 });
  });

  it('errors when OPA returns an empty result (rules not loaded)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expect(
      evaluate(intake, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/no result/);
  });

  it('rejects responses that fail Zod validation (invalid riskTier)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ result: { riskTier: 'made_up_tier' } }),
    );
    await expect(
      evaluate(intake, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow();
  });
});
