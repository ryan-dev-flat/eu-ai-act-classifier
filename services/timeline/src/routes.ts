import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@eu-ai-act/auth';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  findSystemReadiness,
  findPortfolioReadiness,
  type RepositoryDeps,
} from './repository.js';
import type { ObligationDeadline, SystemReadiness, ReadinessStatus } from '@eu-ai-act/shared-types';

const contentDir = resolve(process.cwd(), 'content');

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(resolve(contentDir, file), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

interface ObligationDef {
  id: string;
  article: string;
  title: string;
  effectiveFrom: string;
  riskTiers: string[];
}

async function loadObligations(): Promise<ObligationDef[]> {
  const data = await loadJson<{ obligations: ObligationDef[] }>('obligations.json', {
    obligations: [],
  });
  return data.obligations;
}

function computeReadiness(
  status: string,
  dueDate: Date,
  now: Date,
): ReadinessStatus {
  if (status === 'completed' || status === 'not_applicable') return 'green';
  if (dueDate < now) return 'red';
  const daysUntil = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 90) return 'amber';
  return 'green';
}

function buildSystemReadiness(
  row: Awaited<ReturnType<typeof findSystemReadiness>>,
  obligations: ObligationDef[],
  now: Date,
): SystemReadiness {
  if (!row) throw new Error('unexpected null row');
  const deadlineMap = new Map<string, { status: string; completedAt: Date | null; evidenceLink: string | null }>();
  for (const c of row.completions) {
    deadlineMap.set(c.obligation_id, {
      status: c.status,
      completedAt: c.completed_at,
      evidenceLink: c.evidence_link,
    });
  }

  const obligationDeadlines: ObligationDeadline[] = [];
  for (const obId of row.obligations_json) {
    const def = obligations.find((o) => o.id === obId);
    const comp = deadlineMap.get(obId);
    const due = def?.effectiveFrom ? new Date(def.effectiveFrom) : new Date('2026-08-02');
    const status = comp?.status ?? 'not_started';
    const readiness = computeReadiness(status, due, now);
    obligationDeadlines.push({
      obligationId: obId,
      article: def?.article ?? obId,
      title: def?.title ?? obId,
      dueDate: due.toISOString().slice(0, 10),
      status: status as ObligationDeadline['status'],
      completedAt: comp?.completedAt?.toISOString() ?? null,
      evidenceLink: comp?.evidenceLink ?? null,
      readiness,
    });
  }

  const overallReadiness: ReadinessStatus = obligationDeadlines.some((o) => o.readiness === 'red')
    ? 'red'
    : obligationDeadlines.some((o) => o.readiness === 'amber')
      ? 'amber'
      : 'green';

  return {
    classificationId: row.classification_id,
    systemName: row.system_name,
    riskTier: row.risk_tier,
    overallReadiness,
    obligations: obligationDeadlines,
    openQuestions: row.open_questions.length,
    lastUpdated: row.evaluated_at.toISOString(),
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/v1/timeline/system/:id', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const row = await findSystemReadiness(req.authContext.tenantId, req.params.id);
    if (!row) {
      return reply.code(404).send({ error: 'not_found' });
    }
    const obligations = await loadObligations();
    const readiness = buildSystemReadiness(row, obligations, new Date());
    return readiness;
  });

  app.get('/v1/timeline/portfolio', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await findPortfolioReadiness(req.authContext.tenantId);
    const obligations = await loadObligations();
    const now = new Date();
    const systems = rows.map((r) => buildSystemReadiness(r, obligations, now));
    const summary = {
      total: systems.length,
      red: systems.filter((s) => s.overallReadiness === 'red').length,
      amber: systems.filter((s) => s.overallReadiness === 'amber').length,
      green: systems.filter((s) => s.overallReadiness === 'green').length,
    };
    return { systems, summary };
  });

  app.get('/v1/timeline/calendar', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const data = await loadJson<{ version: string; milestones: unknown[] }>(
      'enforcement-calendar.json',
      { version: 'v1', milestones: [] },
    );
    return data;
  });

  app.get('/v1/timeline/report/aug2026', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await findPortfolioReadiness(req.authContext.tenantId);
    const obligations = await loadObligations();
    const now = new Date();
    const aug2026 = new Date('2026-08-02');
    const systems = rows.map((r) => buildSystemReadiness(r, obligations, now));
    const atRisk = systems.filter((s) => s.overallReadiness === 'red' || s.overallReadiness === 'amber');
    const report = {
      generatedAt: now.toISOString(),
      deadline: aug2026.toISOString().split('T')[0],
      daysRemaining: Math.max(0, Math.ceil((aug2026.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      summary: {
        total: systems.length,
        red: systems.filter((s) => s.overallReadiness === 'red').length,
        amber: systems.filter((s) => s.overallReadiness === 'amber').length,
        green: systems.filter((s) => s.overallReadiness === 'green').length,
      },
      atRiskSystems: atRisk.map((s) => ({
        classificationId: s.classificationId,
        systemName: s.systemName,
        riskTier: s.riskTier,
        overallReadiness: s.overallReadiness,
        openQuestions: s.openQuestions,
        overdueObligations: s.obligations.filter((o) => o.readiness === 'red').map((o) => o.obligationId),
        upcomingObligations: s.obligations.filter((o) => o.readiness === 'amber').map((o) => o.obligationId),
      })),
    };
    return report;
  });
}
