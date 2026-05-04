import { describe, expect, it } from 'vitest';
import type { ClassificationIntake, QuestionnaireAnswer } from '@eu-ai-act/shared-types';
import { evaluate } from './engine.js';

// Integration test against a live OPA server with the v1 rule bundle loaded.
// Gated on `OPA_URL` so it does not run in pure unit-test environments. Bring
// up the local stack with `docker compose up -d opa` and run with:
//   OPA_URL=http://localhost:8181 pnpm --filter @eu-ai-act/classification-engine test
const opaUrl = process.env.OPA_URL;

const baseIntake: Omit<ClassificationIntake, 'answers'> = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  systemId: '00000000-0000-0000-0000-000000000002',
  pathway: 'standard',
  domain: 'hr_tech',
  templateId: 'standard-deployer',
  submitterId: '00000000-0000-0000-0000-000000000003',
};

function answers(map: Record<string, boolean | string | number>): QuestionnaireAnswer[] {
  return Object.entries(map).map(([questionId, value], i) => ({
    questionId,
    value,
    sequence: i,
  }));
}

describe.skipIf(!opaUrl)('evaluate() against live OPA', () => {
  it('defaults to minimal_risk when no answers match any rule', async () => {
    const result = await evaluate({ ...baseIntake, answers: [] }, { opaUrl });
    expect(result.riskTier).toBe('minimal_risk');
    expect(result.obligations).toEqual([]);
    expect(result.triggeredHighRiskReasons).toEqual([]);
  });

  it('classifies recruitment use as high_risk under Annex III(4)(a)', async () => {
    const result = await evaluate(
      {
        ...baseIntake,
        answers: answers({
          used_for_recruitment_or_selection: true,
          performs_narrow_procedural_task: false,
          improves_result_of_prior_human_activity: false,
          detects_decision_patterns_with_human_review: false,
          performs_preparatory_task_only: false,
          performs_profiling_of_natural_persons: false,
        }),
      },
      { opaUrl },
    );
    expect(result.riskTier).toBe('high_risk');
    expect(result.obligations).toContain('art9_risk_management');
    expect(result.obligations).toContain('art13_transparency_to_deployers');
    expect(result.triggeredHighRiskReasons.map((r) => r.id)).toContain(
      'annex_iii_4_a_recruitment',
    );
    expect(result.confidence).toBe(1);
    expect(result.openQuestions).toEqual([]);
  });

  it('flags openQuestions when derogation answers are missing', async () => {
    const result = await evaluate(
      {
        ...baseIntake,
        answers: answers({ used_for_recruitment_or_selection: true }),
      },
      { opaUrl },
    );
    expect(result.riskTier).toBe('high_risk');
    expect(result.confidence).toBeLessThan(1);
    expect(result.openQuestions.length).toBeGreaterThan(0);
  });

  it('classifies social-scoring by public authority as prohibited', async () => {
    const result = await evaluate(
      {
        ...baseIntake,
        answers: answers({ social_scoring_by_public_authority: true }),
      },
      { opaUrl },
    );
    expect(result.riskTier).toBe('prohibited');
    expect(result.obligations).toEqual([]);
  });
});
