import { describe, expect, it } from 'vitest';
import { renderClassificationMemoMarkdown, renderSimplePdf } from './renderers.js';
import type { ClassificationMemoData } from './repository.js';

const memo: ClassificationMemoData = {
  classificationId: '00000000-0000-4000-8000-000000000001',
  systemId: '00000000-0000-4000-8000-000000000002',
  systemName: 'Hiring Assistant',
  domain: 'hr_tech',
  pathway: 'standard',
  result: {
    classificationId: '00000000-0000-4000-8000-000000000001',
    riskTier: 'high_risk',
    obligations: ['art9_risk_management'],
    ruleSetVersion: 'v1',
    confidence: 0.91,
    openQuestions: [],
    rationale: 'Annex III employment use case.',
    triggeredHighRiskReasons: [{ id: 'annex_iii_4', article: 'Annex III(4)', summary: 'Employment' }],
    suppressedHighRiskReasons: [],
    evaluatedAt: '2026-05-11T00:00:00.000Z',
  },
};

describe('export renderers', () => {
  it('renders a classification memo markdown document', () => {
    const md = renderClassificationMemoMarkdown(memo);
    expect(md).toContain('# Classification Memo: Hiring Assistant');
    expect(md).toContain('art9_risk_management');
    expect(md).toContain('Annex III employment use case.');
  });

  it('renders a PDF buffer', () => {
    const pdf = renderSimplePdf('# Test\n\nHello PDF');
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdf.toString()).toContain('%%EOF');
  });
});
