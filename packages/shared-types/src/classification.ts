import { z } from 'zod';

export const RiskTier = z.enum([
  'prohibited',
  'high_risk',
  'limited_risk',
  'minimal_risk',
  'gpai',
  'gpai_systemic_risk',
]);
export type RiskTier = z.infer<typeof RiskTier>;

export const ClassificationPathway = z.enum(['standard', 'gpai']);
export type ClassificationPathway = z.infer<typeof ClassificationPathway>;

export const ClassificationStatus = z.enum([
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'reassessment_required',
]);
export type ClassificationStatus = z.infer<typeof ClassificationStatus>;

export const QuestionnaireAnswer = z.object({
  questionId: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  sequence: z.number().int().nonnegative(),
});
export type QuestionnaireAnswer = z.infer<typeof QuestionnaireAnswer>;

export const ClassificationIntake = z.object({
  tenantId: z.string().uuid(),
  systemId: z.string().uuid(),
  pathway: ClassificationPathway,
  domain: z.enum(['hr_tech', 'fintech', 'martech', 'other']).default('other'),
  templateId: z.string(),
  answers: z.array(QuestionnaireAnswer),
  submitterId: z.string().uuid(),
});
export type ClassificationIntake = z.infer<typeof ClassificationIntake>;

export const TriggeredCategory = z.object({
  id: z.string(),
  article: z.string(),
  summary: z.string(),
});
export type TriggeredCategory = z.infer<typeof TriggeredCategory>;

export const ClassificationResult = z.object({
  classificationId: z.string().uuid(),
  riskTier: RiskTier,
  obligations: z.array(z.string()),
  ruleSetVersion: z.string(),
  confidence: z.number().min(0).max(1),
  openQuestions: z.array(z.string()).default([]),
  rationale: z.string(),
  triggeredHighRiskReasons: z.array(TriggeredCategory).default([]),
  suppressedHighRiskReasons: z.array(TriggeredCategory).default([]),
  evaluatedAt: z.string().datetime(),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;
