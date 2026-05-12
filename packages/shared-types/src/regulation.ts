import { z } from 'zod';

export const Obligation = z.object({
  id: z.string(),
  article: z.string(),
  annex: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  appliesTo: z.array(z.enum(['provider', 'deployer', 'distributor', 'gpai_provider'])),
  riskTiers: z.array(z.string()),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().nullable(),
});
export type Obligation = z.infer<typeof Obligation>;

export const EnforcementAuthority = z.object({
  memberState: z.string().length(2),
  systemDomain: z.enum(['hr_tech', 'fintech', 'martech', 'general']),
  authorityName: z.string(),
  contactUrl: z.string().url(),
  notes: z.string().optional(),
});
export type EnforcementAuthority = z.infer<typeof EnforcementAuthority>;

export const RegulatoryChange = z.object({
  id: z.string(),
  publishedAt: z.string().datetime(),
  source: z.enum(['eur-lex', 'ai-office', 'national']),
  title: z.string(),
  summary: z.string(),
  affectedCategories: z.array(z.string()),
  url: z.string().url(),
});
export type RegulatoryChange = z.infer<typeof RegulatoryChange>;

export const ReadinessStatus = z.enum(['red', 'amber', 'green']);
export type ReadinessStatus = z.infer<typeof ReadinessStatus>;

export const ObligationDeadline = z.object({
  obligationId: z.string(),
  article: z.string(),
  title: z.string(),
  dueDate: z.string().date(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']),
  completedAt: z.string().datetime().nullable(),
  evidenceLink: z.string().url().nullable(),
  readiness: ReadinessStatus,
});
export type ObligationDeadline = z.infer<typeof ObligationDeadline>;

export const SystemReadiness = z.object({
  classificationId: z.string().uuid(),
  systemName: z.string(),
  riskTier: z.string(),
  overallReadiness: ReadinessStatus,
  obligations: z.array(ObligationDeadline),
  openQuestions: z.number().int(),
  lastUpdated: z.string().datetime(),
});
export type SystemReadiness = z.infer<typeof SystemReadiness>;

export const PortfolioReadiness = z.object({
  systems: z.array(SystemReadiness),
  summary: z.object({
    total: z.number().int(),
    red: z.number().int(),
    amber: z.number().int(),
    green: z.number().int(),
  }),
});
export type PortfolioReadiness = z.infer<typeof PortfolioReadiness>;

export const EnforcementMilestone = z.object({
  id: z.string(),
  date: z.string().date(),
  scope: z.string(),
  description: z.string(),
});
export type EnforcementMilestone = z.infer<typeof EnforcementMilestone>;
