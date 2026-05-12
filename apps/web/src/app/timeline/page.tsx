'use client';

import { usePortfolioReadiness, useAug2026Report, useCreateExport } from '@/lib/hooks';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    green: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${map[status] ?? 'bg-gray-100'}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function TimelinePage() {
  const portfolio = usePortfolioReadiness();
  const report = useAug2026Report();
  const createExport = useCreateExport();

  async function exportReadiness(format: 'pdf' | 'markdown' | 'docx') {
    const record = await createExport.mutateAsync({ type: 'aug2026_readiness', format });
    window.open(`/api/exports/${record.exportId}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">August 2026 readiness</h1>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={createExport.isPending}
          onClick={() => exportReadiness('pdf')}
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export to PDF
        </button>
        <button
          type="button"
          disabled={createExport.isPending}
          onClick={() => exportReadiness('docx')}
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export to DOCX
        </button>
        <button
          type="button"
          disabled={createExport.isPending}
          onClick={() => exportReadiness('markdown')}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Export to Markdown
        </button>
        {createExport.error && <span className="text-sm text-red-600">{createExport.error.message}</span>}
      </div>

      {/* Summary cards */}
      {report.data && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Days remaining</p>
            <p className="text-2xl font-bold">{report.data.daysRemaining}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Systems</p>
            <p className="text-2xl font-bold">{report.data.summary.total}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-red-600">At risk</p>
            <p className="text-2xl font-bold text-red-700">{report.data.summary.red + report.data.summary.amber}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-green-600">Ready</p>
            <p className="text-2xl font-bold text-green-700">{report.data.summary.green}</p>
          </div>
        </div>
      )}

      {/* Portfolio list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Portfolio readiness</h2>
        {portfolio.isLoading && <p className="text-gray-500">Loading portfolio…</p>}
        {portfolio.error && <p className="text-red-600">Failed to load portfolio data.</p>}
        {portfolio.data?.summary.total === 0 && (
          <p className="text-gray-500">No classified systems yet. Run the wizard to classify your first system.</p>
        )}
        <div className="space-y-3">
          {portfolio.data?.systems.map((s) => (
            <div key={s.classificationId} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{s.systemName}</h3>
                  <p className="text-sm text-gray-500">
                    {s.riskTier} · {s.obligations.length} obligations · {s.openQuestions} open questions
                  </p>
                </div>
                <StatusBadge status={s.overallReadiness} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.obligations.map((o) => (
                  <span
                    key={o.obligationId}
                    className={`text-xs rounded px-2 py-1 border ${
                      o.readiness === 'red'
                        ? 'border-red-200 bg-red-50'
                        : o.readiness === 'amber'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-green-200 bg-green-50'
                    }`}
                    title={`${o.title} — due ${o.dueDate}`}
                  >
                    {o.article} ({o.status.replace('_', ' ')})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Aug 2026 report */}
      {report.data && report.data.atRiskSystems.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">At-risk systems (Aug 2026)</h2>
          <div className="space-y-2">
            {report.data.atRiskSystems.map((s) => (
              <div key={s.classificationId} className="border rounded p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{s.systemName}</p>
                  <p className="text-sm text-gray-500">
                    {s.overdueObligations.length} overdue · {s.upcomingObligations.length} upcoming
                  </p>
                </div>
                <StatusBadge status={s.overallReadiness} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
