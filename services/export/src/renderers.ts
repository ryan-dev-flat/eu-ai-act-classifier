import type { ClassificationMemoData } from './repository.js';

export function renderClassificationMemoMarkdown(data: ClassificationMemoData): string {
  const r = data.result;
  return [
    `# Classification Memo: ${data.systemName}`,
    '',
    `- **Classification ID:** ${data.classificationId}`,
    `- **System ID:** ${data.systemId}`,
    `- **Domain:** ${data.domain}`,
    `- **Pathway:** ${data.pathway}`,
    `- **Risk tier:** ${r.riskTier}`,
    `- **Rule set:** ${r.ruleSetVersion}`,
    `- **Confidence:** ${Math.round(r.confidence * 100)}%`,
    `- **Evaluated at:** ${r.evaluatedAt}`,
    '',
    '## Rationale',
    r.rationale,
    '',
    '## Obligations',
    ...(r.obligations.length ? r.obligations.map((o) => `- ${o}`) : ['No obligations triggered.']),
    '',
    '## Triggered High-Risk Reasons',
    ...(r.triggeredHighRiskReasons.length
      ? r.triggeredHighRiskReasons.map((x) => `- **${x.article}:** ${x.summary}`)
      : ['No high-risk reasons triggered.']),
    '',
    '## Suppressed Reasons',
    ...(r.suppressedHighRiskReasons.length
      ? r.suppressedHighRiskReasons.map((x) => `- **${x.article}:** ${x.summary}`)
      : ['No reasons suppressed by Article 6(3).']),
    '',
    '## Open Questions',
    ...(r.openQuestions.length ? r.openQuestions.map((q) => `- ${q}`) : ['No open questions.']),
    '',
  ].join('\n');
}

export function renderReadinessReportMarkdown(report: any): string {
  const atRisk = Array.isArray(report.atRiskSystems) ? report.atRiskSystems : [];
  return [
    '# August 2026 Readiness Report',
    '',
    `- **Generated at:** ${report.generatedAt}`,
    `- **Deadline:** ${report.deadline}`,
    `- **Days remaining:** ${report.daysRemaining}`,
    '',
    '## Portfolio Summary',
    `- Total systems: ${report.summary?.total ?? 0}`,
    `- Red: ${report.summary?.red ?? 0}`,
    `- Amber: ${report.summary?.amber ?? 0}`,
    `- Green: ${report.summary?.green ?? 0}`,
    '',
    '## At-Risk Systems',
    ...(atRisk.length
      ? atRisk.flatMap((s: any) => [
          `### ${s.systemName}`,
          `- Classification ID: ${s.classificationId}`,
          `- Risk tier: ${s.riskTier}`,
          `- Readiness: ${s.overallReadiness}`,
          `- Open questions: ${s.openQuestions}`,
          `- Overdue obligations: ${(s.overdueObligations ?? []).join(', ') || 'None'}`,
          `- Upcoming obligations: ${(s.upcomingObligations ?? []).join(', ') || 'None'}`,
          '',
        ])
      : ['No at-risk systems.']),
    '',
  ].join('\n');
}

export function renderSimplePdf(markdown: string): Buffer {
  const textLines = markdown
    .replace(/^#+\s*/gm, '')
    .split('\n')
    .flatMap((line) => wrap(line, 88))
    .slice(0, 46);
  const commands = ['BT', '/F1 10 Tf', '50 780 Td'];
  for (const [idx, line] of textLines.entries()) {
    if (idx > 0) commands.push('0 -15 Td');
    commands.push(`(${escapePdf(line)}) Tj`);
  }
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let offset = '%PDF-1.4\n'.length;
  const xref = ['xref', '0 6', '0000000000 65535 f '];
  for (const obj of objects) {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
    offset += Buffer.byteLength(obj);
  }
  const body = `%PDF-1.4\n${objects.join('')}`;
  const trailer = `${xref.join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(body)}\n%%EOF\n`;
  return Buffer.from(body + trailer);
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const words = line.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

/* ── DOCX renderers ── */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { after: 120 } });
}

function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 80 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

export async function renderClassificationMemoDocx(data: ClassificationMemoData): Promise<Buffer> {
  const r = data.result;
  const doc = new Document({
    title: `Classification Memo: ${data.systemName}`,
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        heading(`Classification Memo: ${data.systemName}`, HeadingLevel.HEADING_1),
        body(`Classification ID: ${data.classificationId}`),
        body(`System ID: ${data.systemId}`),
        body(`Domain: ${data.domain}`),
        body(`Pathway: ${data.pathway}`),
        body(`Risk tier: ${r.riskTier}`),
        body(`Rule set: ${r.ruleSetVersion}`),
        body(`Confidence: ${Math.round(r.confidence * 100)}%`),
        body(`Evaluated at: ${r.evaluatedAt}`),
        heading('Rationale', HeadingLevel.HEADING_2),
        body(r.rationale),
        heading('Obligations', HeadingLevel.HEADING_2),
        ...(r.obligations.length ? r.obligations.map(bullet) : [body('No obligations triggered.')]),
        heading('Triggered High-Risk Reasons', HeadingLevel.HEADING_2),
        ...(r.triggeredHighRiskReasons.length
          ? r.triggeredHighRiskReasons.map((x) => bullet(`${x.article}: ${x.summary}`))
          : [body('No high-risk reasons triggered.')]),
        heading('Suppressed Reasons', HeadingLevel.HEADING_2),
        ...(r.suppressedHighRiskReasons.length
          ? r.suppressedHighRiskReasons.map((x) => bullet(`${x.article}: ${x.summary}`))
          : [body('No reasons suppressed by Article 6(3).')]),
        heading('Open Questions', HeadingLevel.HEADING_2),
        ...(r.openQuestions.length ? r.openQuestions.map(bullet) : [body('No open questions.')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function renderReadinessReportDocx(report: unknown): Promise<Buffer> {
  const r = report as any;
  const atRisk = Array.isArray(r.atRiskSystems) ? r.atRiskSystems : [];
  const children: Paragraph[] = [
    heading('August 2026 Readiness Report', HeadingLevel.HEADING_1),
    body(`Generated at: ${r.generatedAt ?? 'N/A'}`),
    body(`Deadline: ${r.deadline ?? 'N/A'}`),
    body(`Days remaining: ${r.daysRemaining ?? 'N/A'}`),
    heading('Portfolio Summary', HeadingLevel.HEADING_2),
    body(`Total systems: ${r.summary?.total ?? 0}`),
    body(`Red: ${r.summary?.red ?? 0}`),
    body(`Amber: ${r.summary?.amber ?? 0}`),
    body(`Green: ${r.summary?.green ?? 0}`),
    heading('At-Risk Systems', HeadingLevel.HEADING_2),
  ];

  if (atRisk.length) {
    for (const s of atRisk) {
      children.push(heading(s.systemName, HeadingLevel.HEADING_3));
      children.push(body(`Classification ID: ${s.classificationId}`));
      children.push(body(`Risk tier: ${s.riskTier}`));
      children.push(body(`Readiness: ${s.overallReadiness}`));
      children.push(body(`Open questions: ${s.openQuestions}`));
      children.push(body(`Overdue obligations: ${(s.overdueObligations ?? []).join(', ') || 'None'}`));
      children.push(body(`Upcoming obligations: ${(s.upcomingObligations ?? []).join(', ') || 'None'}`));
    }
  } else {
    children.push(body('No at-risk systems.'));
  }

  const doc = new Document({
    title: 'August 2026 Readiness Report',
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
