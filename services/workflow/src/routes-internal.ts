import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '@eu-ai-act/auth';
import type { AuditClient } from '@eu-ai-act/audit-client';
import {
  createInstance,
  type RepositoryDeps,
  type WorkflowInstanceRow,
} from './repository.js';
import { chainForResult } from './state-machine.js';
import type { ClassificationResult } from '@eu-ai-act/shared-types';
import type { NotificationClient } from './notification-client.js';

const CreateBody = z.object({
  classificationId: z.string().uuid(),
  result: z.object({
    classificationId: z.string().uuid(),
    riskTier: z.enum([
      'prohibited',
      'high_risk',
      'limited_risk',
      'minimal_risk',
      'gpai',
      'gpai_systemic_risk',
    ]),
  }).passthrough(),
});

interface InternalRoutesDeps {
  repo?: RepositoryDeps;
  audit: AuditClient | null;
  notification?: NotificationClient | null;
}

/**
 * Service-to-service endpoint used by the classification-engine to bootstrap
 * a workflow once a high-risk / GPAI classification has been persisted. Not
 * exposed to end users; access still goes through `requireAuth` so the call
 * carries an authenticated tenant context.
 */
export function registerInternalWorkflowRoutes(
  app: FastifyInstance,
  deps: InternalRoutesDeps,
): void {
  app.post('/v1/workflows', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = CreateBody.parse(req.body);
    const chain = chainForResult(body.result as ClassificationResult);
    if (!chain) {
      return reply
        .code(400)
        .send({ error: 'no_workflow_required', message: `risk tier ${body.result.riskTier} does not require approval` });
    }
    const instance = await createInstance(
      req.authContext.tenantId,
      body.classificationId,
      chain,
      deps.repo,
    );
    const firstTask = instance.tasks[0];
    const taskCreatedEvent = {
      tenantId: req.authContext.tenantId,
      userId: req.authContext.userId,
      eventType: 'workflow.task_created' as const,
      entityType: 'workflow',
      entityId: instance.id,
      payload: {
        classificationId: instance.classificationId,
        workflowId: instance.id,
        chainDefinitionId: instance.chainDefinitionId,
        taskId: firstTask?.id,
        role: firstTask?.role,
        assigneeId: firstTask?.assigneeId ?? null,
      },
      timestamp: new Date().toISOString(),
    };

    if (deps.audit) {
      try {
        await deps.audit.write(
          taskCreatedEvent,
          { token: req.authContext.token },
        );
      } catch (err) {
        req.log.error({ err }, 'workflow audit write failed');
      }
    }
    if (deps.notification && firstTask) {
      try {
        const roles = req.headers['x-roles'];
        await deps.notification.publish(taskCreatedEvent, {
          token: req.authContext.token,
          tenantId: req.authContext.tenantId,
          userId: req.authContext.userId,
          roles: Array.isArray(roles) ? roles[0] : roles,
        });
      } catch (err) {
        req.log.error({ err }, 'workflow task-created notification failed');
      }
    }
    return reply.code(201).send(serialise(instance));
  });
}

export function serialise(row: WorkflowInstanceRow): WorkflowInstanceRow {
  return row;
}
