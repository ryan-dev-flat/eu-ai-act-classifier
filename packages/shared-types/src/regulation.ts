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
