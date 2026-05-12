'use client';

import type { ClassificationResult, RiskTier, TriggeredCategory } from '@eu-ai-act/shared-types';
import { useClassification, useCreateExport } from '@/lib/hooks';

const TIER_STYLE: Record<RiskTier, { label: string; className: string }> = {
  prohibited: { label: 'Prohibited', className: 'bg-red-100 text-red-800 border-red-300' },
  high_risk: { label: 'High risk', className: 'bg-orange-100 text-orange-800 border-orange-300' },
  limited_risk: { label: 'Limited risk', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  minimal_risk: { label: 'Minimal risk', className: 'bg-green-100 text-green-800 border-green-300' },
  gpai: { label: 'GPAI', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  gpai_systemic_risk: { label: 'GPAI · systemic', className: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export default function ClassificationDetailPage({ params }: { params: { id: string } }) {
  const query = useClassification(params.id);

  if (query.isLoading) return <p className="text-sm text-gray-600">Loading…</p>;
  if (query.error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load classification: {query.error.message}
      </div>
    );
  }
  if (!query.data) return null;

  return <ResultView result={query.data} id={params.id} />;
}

function ResultView({ result, id }: { result: ClassificationResult; id: string }) {
  const createExport = useCreateExport();
  const tier = TIER_STYLE[result.riskTier] ?? {
    label: result.riskTier,
    className: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Classification</h1>
        <p className="mt-1 font-mono text-xs text-gray-500">{id}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ExportButton
          label="Export to PDF"
          disabled={createExport.isPending}
          onClick={() => createClassificationExport(id, 'pdf', createExport.mutateAsync)}
        />
        <ExportButton
          label="Export to DOCX"
          disabled={createExport.isPending}
          onClick={() => createClassificationExport(id, 'docx', createExport.mutateAsync)}
        />
        <ExportButton
          label="Export to Markdown"
          disabled={createExport.isPending}
          onClick={() => createClassificationExport(id, 'markdown', createExport.mutateAsync)}
        />
        {createExport.error && <span className="text-sm text-red-600">{createExport.error.message}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${tier.className}`}>
          {tier.label}
        </span>
        <span className="text-xs text-gray-500">
          rules <code>{result.ruleSetVersion}</code> · confidence{' '}
          {Math.round(result.confidence * 100)}% · evaluated{' '}
          {new Date(result.evaluatedAt).toLocaleString()}
        </span>
      </div>

      {result.openQuestions.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Open questions</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
            {result.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Rationale">
        <p className="whitespace-pre-wrap text-sm">{result.rationale}</p>
      </Section>

      <Section title={`Obligations (${result.obligations.length})`}>
        {result.obligations.length === 0 ? (
          <p className="text-sm text-gray-500">No obligations triggered.</p>
        ) : (
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {result.obligations.map((o) => (
              <li key={o} className="rounded border border-gray-200 px-3 py-2 font-mono text-xs">
                {o}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {result.triggeredHighRiskReasons.length > 0 && (
        <Section title={`Triggered high-risk reasons (${result.triggeredHighRiskReasons.length})`}>
          <ReasonList reasons={result.triggeredHighRiskReasons} tone="triggered" />
        </Section>
      )}

      {result.suppressedHighRiskReasons.length > 0 && (
        <Section title={`Suppressed by Article 6(3) (${result.suppressedHighRiskReasons.length})`}>
          <ReasonList reasons={result.suppressedHighRiskReasons} tone="suppressed" />
        </Section>
      )}
    </div>
  );
}

async function createClassificationExport(
  classificationId: string,
  format: 'pdf' | 'markdown' | 'docx',
  mutate: ReturnType<typeof useCreateExport>['mutateAsync'],
): Promise<void> {
  const record = await mutate({ type: 'classification_memo', format, classificationId });
  window.open(`/api/exports/${record.exportId}`, '_blank', 'noopener,noreferrer');
}

function ExportButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ReasonList({ reasons, tone }: { reasons: TriggeredCategory[]; tone: 'triggered' | 'suppressed' }) {
  const colour =
    tone === 'triggered'
      ? 'border-orange-200 bg-orange-50'
      : 'border-gray-200 bg-gray-50 text-gray-600 line-through decoration-gray-400';
  return (
    <ul className="space-y-2">
      {reasons.map((r) => (
        <li key={r.id} className={`rounded border p-3 text-sm ${colour}`}>
          <div className="font-medium">{r.article}</div>
          <div className="mt-1 text-xs">{r.summary}</div>
        </li>
      ))}
    </ul>
  );
}
