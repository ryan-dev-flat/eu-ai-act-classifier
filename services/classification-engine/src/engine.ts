import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  RiskTier,
  TriggeredCategory,
  type ClassificationIntake,
  type ClassificationResult,
} from '@eu-ai-act/shared-types';

// Raw OPA response. Rego emits sets that are JSON-serialised as arrays. Field
// names match `data.eu_ai_act.classification` exactly — snake_case identifiers
// from the rule set are translated to camelCase below before leaving this
// module.
const OpaResponse = z.object({
  result: z
    .object({
      riskTier: RiskTier,
      obligations: z.array(z.string()).default([]),
      confidence: z.number().min(0).max(1).default(0),
      rationale: z.string().default(''),
      openQuestions: z.array(z.string()).default([]),
      triggered_high_risk_reasons: z.array(TriggeredCategory).default([]),
      suppressed_high_risk_reasons: z.array(TriggeredCategory).default([]),
    })
    .optional(),
});

export class OpaUnavailableError extends Error {
  override readonly name = 'OpaUnavailableError';
  constructor(opaUrl: string, cause: unknown) {
    super(`OPA unreachable at ${opaUrl}: ${(cause as Error)?.message ?? cause}`);
    this.cause = cause;
  }
}

export class OpaEvaluationError extends Error {
  override readonly name = 'OpaEvaluationError';
  constructor(public readonly status: number, body: string) {
    super(`OPA evaluation failed: ${status} ${body.slice(0, 256)}`);
  }
}

export interface EvaluateOptions {
  /** Override OPA endpoint (defaults to env OPA_URL or http://localhost:8181). */
  opaUrl?: string;
  /** Override active rule-set version stamp on the result. */
  ruleSetVersion?: string;
  /** Injectable fetch for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable id generator for testing. Defaults to crypto.randomUUID. */
  idGenerator?: () => string;
  /** Injectable clock for testing. Defaults to Date.now. */
  now?: () => Date;
}

/**
 * Submits an intake to the OPA sidecar and returns a typed ClassificationResult.
 * See architecture §3.1 and `rules/v1/`. The query path is fixed to
 * `/v1/data/eu_ai_act/classification` because the rule bundle declares
 * `package eu_ai_act.classification` across all files.
 */
export async function evaluate(
  intake: ClassificationIntake,
  opts: EvaluateOptions = {},
): Promise<ClassificationResult> {
  const opaUrl = opts.opaUrl ?? process.env.OPA_URL ?? 'http://localhost:8181';
  const ruleSetVersion = opts.ruleSetVersion ?? process.env.RULES_ACTIVE_VERSION ?? 'v1';
  const doFetch = opts.fetchImpl ?? fetch;
  const newId = opts.idGenerator ?? randomUUID;
  const clock = opts.now ?? (() => new Date());

  let res: Response;
  try {
    res = await doFetch(`${opaUrl}/v1/data/eu_ai_act/classification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: intake }),
    });
  } catch (err) {
    throw new OpaUnavailableError(opaUrl, err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OpaEvaluationError(res.status, body);
  }

  const json = (await res.json()) as unknown;
  const parsed = OpaResponse.parse(json);
  const r = parsed.result;

  if (!r) {
    throw new Error(
      'OPA returned no result for data.eu_ai_act.classification. ' +
        'The rule bundle may not be loaded into the OPA server.',
    );
  }

  return {
    classificationId: newId(),
    riskTier: r.riskTier,
    obligations: r.obligations,
    ruleSetVersion,
    confidence: r.confidence,
    openQuestions: r.openQuestions,
    rationale: r.rationale,
    triggeredHighRiskReasons: r.triggered_high_risk_reasons,
    suppressedHighRiskReasons: r.suppressed_high_risk_reasons,
    evaluatedAt: clock().toISOString(),
  };
}
