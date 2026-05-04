import type { FastifyInstance } from 'fastify';
import { ClassificationIntake } from '@eu-ai-act/shared-types';
import type { AuditClient } from '@eu-ai-act/audit-client';
import { createHttpAuditClient } from '@eu-ai-act/audit-client';
import { requireAuth } from '@eu-ai-act/auth';
import { evaluate, OpaEvaluationError, OpaUnavailableError } from './engine.js';
import {
  findClassificationById,
  persistClassification,
  type RepositoryDeps,
} from './repository.js';
import {
  createHttpWorkflowClient,
  requiresWorkflow,
  type WorkflowClient,
} from './workflow-client.js';

export interface RoutesDeps {
  /** Audit client for emitting classification events. */
  audit?: AuditClient;
  /** Workflow client for bootstrapping approval chains on high-risk results. */
  workflow?: WorkflowClient | null;
  /** Database overrides for the repository (used by tests). */
  repo?: RepositoryDeps;
}

function defaultAuditClient(): AuditClient | null {
  const url = process.env.AUDIT_LOG_URL;
  return url ? createHttpAuditClient(url) : null;
}

function defaultWorkflowClient(): WorkflowClient | null {
  const url = process.env.WORKFLOW_URL;
  return url ? createHttpWorkflowClient(url) : null;
}

export async function registerRoutes(app: FastifyInstance, deps: RoutesDeps = {}): Promise<void> {
  const audit = deps.audit ?? defaultAuditClient();
  const workflow = deps.workflow === undefined ? defaultWorkflowClient() : deps.workflow;

  app.post('/v1/classifications', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    // Force tenant/user identity from the verified auth context so a malicious
    // client cannot post intakes on behalf of a different tenant.
    const body = ClassificationIntake.parse(req.body);
    const intake: ClassificationIntake = {
      ...body,
      tenantId: req.authContext.tenantId,
      submitterId: req.authContext.userId,
    };
    let result;
    try {
      result = await evaluate(intake);
    } catch (err) {
      if (err instanceof OpaUnavailableError) {
        req.log.error({ err }, 'OPA unreachable');
        return reply.code(502).send({ error: 'opa_unavailable', message: err.message });
      }
      if (err instanceof OpaEvaluationError) {
        req.log.error({ err, status: err.status }, 'OPA evaluation failed');
        return reply.code(502).send({ error: 'opa_evaluation_failed', message: err.message });
      }
      throw err;
    }

    await persistClassification(intake, result, deps.repo);

    // Audit write-ahead per architecture §3.7. If the audit-log service is not
    // configured we log a warning but still return the persisted result; the
    // CI rule pipeline will fail-loud once AUDIT_LOG_URL is wired everywhere.
    if (audit) {
      try {
        await audit.write(
          {
            tenantId: intake.tenantId,
            userId: intake.submitterId,
            eventType: 'classification.evaluated',
            entityType: 'classification',
            entityId: result.classificationId,
            payload: {
              riskTier: result.riskTier,
              obligations: result.obligations,
              confidence: result.confidence,
              ruleSetVersion: result.ruleSetVersion,
              triggeredHighRiskReasons: result.triggeredHighRiskReasons,
              suppressedHighRiskReasons: result.suppressedHighRiskReasons,
            },
          },
          { token: req.authContext.token },
        );
      } catch (err) {
        req.log.error({ err }, 'audit-log write failed');
        return reply.code(502).send({ error: 'audit_write_failed' });
      }
    } else {
      req.log.warn('AUDIT_LOG_URL is not set; classification.evaluated event was not recorded');
    }

    // Bootstrap an approval workflow when the result requires one. Failures are
    // logged but do not fail the classification response — the user has already
    // received a verdict and the workflow can be retried out-of-band.
    if (workflow && requiresWorkflow(result.riskTier)) {
      try {
        const auth = req.headers.authorization;
        const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : undefined;
        const rolesHeader = req.headers['x-roles'];
        const roles = Array.isArray(rolesHeader) ? rolesHeader[0] : rolesHeader;
        await workflow.createForResult(result.classificationId, result, {
          tenantId: intake.tenantId,
          userId: intake.submitterId,
          authToken: token,
          roles,
        });
      } catch (err) {
        req.log.error({ err }, 'workflow bootstrap failed');
      }
    }

    return reply.code(201).send(result);
  });

  app.get<{ Params: { id: string } }>('/v1/classifications/:id', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const result = await findClassificationById(
      req.authContext.tenantId,
      req.params.id,
      deps.repo,
    );
    if (!result) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return reply.code(200).send(result);
  });

  app.put<{ Params: { id: string } }>('/v1/classifications/:id/reassess', async (_req, reply) => {
    return reply.code(501).send({ error: 'not_implemented' });
  });

  app.get<{ Params: { id: string } }>(
    '/v1/classifications/:id/obligations',
    async (_req, reply) => {
      return reply.code(501).send({ error: 'not_implemented' });
    },
  );

  app.post<{ Params: { id: string } }>('/v1/classifications/:id/approve', async (_req, reply) => {
    return reply.code(501).send({ error: 'not_implemented' });
  });
}
