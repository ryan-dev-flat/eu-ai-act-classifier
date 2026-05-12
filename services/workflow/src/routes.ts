import type { FastifyInstance } from 'fastify';
import { WorkflowAction, type ReviewerRole } from '@eu-ai-act/shared-types';
import { requireAuth } from '@eu-ai-act/auth';
import {
  createHttpAuditClient,
  type AuditClient,
} from '@eu-ai-act/audit-client';
import {
  applyAction,
  getByClassification,
  type RepositoryDeps,
} from './repository.js';
import {
  CHAIN_REGISTRY,
  transition,
  isTerminal,
} from './state-machine.js';
import { registerInternalWorkflowRoutes } from './routes-internal.js';
import {
  createHttpNotificationClient,
  type NotificationClient,
} from './notification-client.js';

export interface RoutesDeps {
  audit?: AuditClient;
  repo?: RepositoryDeps;
  notification?: NotificationClient;
}

function defaultAuditClient(): AuditClient | null {
  const url = process.env.AUDIT_LOG_URL;
  return url ? createHttpAuditClient(url) : null;
}

function defaultNotificationClient(): NotificationClient | null {
  const url = process.env.NOTIFICATION_URL;
  return url ? createHttpNotificationClient(url) : null;
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: RoutesDeps = {},
): Promise<void> {
  const audit = deps.audit ?? defaultAuditClient();
  const notification = deps.notification ?? defaultNotificationClient();
  registerInternalWorkflowRoutes(app, { audit, notification, repo: deps.repo });

  app.get<{ Params: { classification_id: string } }>(
    '/v1/workflows/:classification_id',
    async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const inst = await getByClassification(
        req.authContext.tenantId,
        req.params.classification_id,
        deps.repo,
      );
      if (!inst) return reply.code(404).send({ error: 'not_found' });
      return reply.code(200).send(inst);
    },
  );

  app.post<{ Params: { classification_id: string } }>(
    '/v1/workflows/:classification_id/action',
    async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const action = WorkflowAction.parse(req.body);
      const inst = await getByClassification(
        req.authContext.tenantId,
        req.params.classification_id,
        deps.repo,
      );
      if (!inst) return reply.code(404).send({ error: 'not_found' });
      if (isTerminal(inst.state)) {
        return reply
          .code(409)
          .send({ error: 'workflow_terminal', message: `state is ${inst.state}` });
      }
      const chain = CHAIN_REGISTRY[inst.chainDefinitionId];
      if (!chain) {
        return reply
          .code(500)
          .send({ error: 'unknown_chain', message: inst.chainDefinitionId });
      }
      const activeTask = inst.tasks.find((t) => !t.completedAt);
      if (!activeTask || activeTask.id !== action.taskId) {
        return reply.code(400).send({ error: 'task_not_active' });
      }
      const requiredRole = chain.steps[inst.currentStep]?.role;
      if (!requiredRole) return reply.code(500).send({ error: 'chain_step_missing' });
      const actorRole = pickPrimaryRole(req.authContext.roles as ReviewerRole[]);

      let next;
      try {
        next = transition({
          state: inst.state,
          currentStep: inst.currentStep,
          totalSteps: chain.steps.length,
          actorRole,
          requiredRole,
          action: action.action,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'invalid transition';
        return reply.code(409).send({ error: 'invalid_transition', message: msg });
      }

      const nextRole = next.createNextTask
        ? chain.steps[next.nextStep]?.role
        : undefined;

      const updated = await applyAction(
        req.authContext.tenantId,
        {
          classificationId: req.params.classification_id,
          taskId: action.taskId,
          action: action.action,
          actorId: req.authContext.userId,
          comment: action.comment,
          nextState: next.nextState,
          nextStep: next.nextStep,
          completeCurrentTask: next.completeCurrentTask,
          newTaskRole: nextRole,
        },
        deps.repo,
      );

      if (audit) {
        try {
          await audit.write(
            {
              tenantId: req.authContext.tenantId,
              userId: req.authContext.userId,
              eventType: 'workflow.task_completed',
              entityType: 'workflow',
              entityId: updated.id,
              payload: {
                classificationId: updated.classificationId,
                taskId: action.taskId,
                action: action.action,
                comment: action.comment ?? null,
                previousState: inst.state,
                nextState: next.nextState,
              },
            },
            { token: req.authContext.token },
          );
        } catch (err) {
          req.log.error({ err }, 'workflow audit write failed');
        }
      }
      if (notification && nextRole) {
        try {
          const newTask = updated.tasks.find((t) => !t.completedAt && t.role === nextRole);
          if (newTask) {
            const roles = req.headers['x-roles'];
            await notification.publish(
              {
                tenantId: req.authContext.tenantId,
                userId: req.authContext.userId,
                eventType: 'workflow.task_created',
                entityType: 'workflow',
                entityId: updated.id,
                payload: {
                  classificationId: updated.classificationId,
                  workflowId: updated.id,
                  chainDefinitionId: updated.chainDefinitionId,
                  taskId: newTask.id,
                  role: newTask.role,
                  assigneeId: newTask.assigneeId,
                },
                timestamp: new Date().toISOString(),
              },
              {
                token: req.authContext.token,
                tenantId: req.authContext.tenantId,
                userId: req.authContext.userId,
                roles: Array.isArray(roles) ? roles[0] : roles,
              },
            );
          }
        } catch (err) {
          req.log.error({ err }, 'workflow task-created notification failed');
        }
      }
      return reply.code(200).send(updated);
    },
  );

  app.get('/v1/workflows/queue', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );

  app.post('/v1/workflows/rules', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented' }),
  );
}

/**
 * Picks the most authoritative reviewer role from the auth context. Admin
 * trumps everything; otherwise the first known reviewer role is used.
 */
function pickPrimaryRole(roles: ReviewerRole[]): ReviewerRole {
  if (roles.includes('admin')) return 'admin';
  const known: ReviewerRole[] = ['legal', 'privacy', 'governance'];
  for (const r of known) if (roles.includes(r)) return r;
  return roles[0] ?? 'governance';
}
