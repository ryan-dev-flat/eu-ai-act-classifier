import {
  getPrimaryPool,
  withTransaction,
  type Pool,
  type PoolClient,
} from '@eu-ai-act/db';
import type { ReviewerRole, WorkflowState } from '@eu-ai-act/shared-types';
import type { ChainDefinition } from './state-machine.js';
import { loadByClassification } from './repository-load.js';

export interface RepositoryDeps {
  pool?: Pool;
}

export interface WorkflowTaskRow {
  id: string;
  workflowId: string;
  role: ReviewerRole;
  assigneeId: string | null;
  action: string | null;
  comment: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkflowInstanceRow {
  id: string;
  classificationId: string;
  state: WorkflowState;
  currentStep: number;
  chainDefinitionId: string;
  createdAt: string;
  updatedAt: string;
  tasks: WorkflowTaskRow[];
}

/**
 * Creates a workflow instance and the first reviewer task atomically. Returns
 * the persisted row. Idempotent on (classification_id) — if a workflow already
 * exists for this classification, the existing row is returned unchanged so
 * the classification-engine can retry creation safely.
 */
export async function createInstance(
  tenantId: string,
  classificationId: string,
  chain: ChainDefinition,
  deps: RepositoryDeps = {},
): Promise<WorkflowInstanceRow> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const existing = await loadByClassification(client, classificationId);
    if (existing) return existing;

    const ins = await client.query<{ id: string }>(
      `INSERT INTO workflow_instances (classification_id, state, current_step, chain_definition_id)
       VALUES ($1,'pending',0,$2)
       RETURNING id`,
      [classificationId, chain.id],
    );
    const workflowId = ins.rows[0]!.id;
    const firstStep = chain.steps[0]!;
    await client.query(
      `INSERT INTO workflow_tasks (workflow_id, role) VALUES ($1,$2)`,
      [workflowId, firstStep.role],
    );
    const fresh = await loadByClassification(client, classificationId);
    if (!fresh) throw new Error('createInstance: failed to read back inserted workflow');
    return fresh;
  });
}

export async function getByClassification(
  tenantId: string,
  classificationId: string,
  deps: RepositoryDeps = {},
): Promise<WorkflowInstanceRow | null> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    return loadByClassification(client, classificationId);
  });
}

export interface ApplyActionInput {
  classificationId: string;
  taskId: string;
  action: string;
  actorId: string;
  comment?: string;
  nextState: WorkflowState;
  nextStep: number;
  completeCurrentTask: boolean;
  /** When defined, a new task is appended for the next step. */
  newTaskRole?: ReviewerRole;
}

/**
 * Applies a state transition computed by the state machine. Caller is
 * responsible for validating role + action; this function only persists.
 */
export async function applyAction(
  tenantId: string,
  input: ApplyActionInput,
  deps: RepositoryDeps = {},
): Promise<WorkflowInstanceRow> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const inst = await loadByClassification(client, input.classificationId);
    if (!inst) throw new Error('workflow not found');

    if (input.completeCurrentTask) {
      await client.query(
        `UPDATE workflow_tasks
            SET action = $1, comment = COALESCE($2, comment),
                assignee_id = $3, completed_at = NOW()
          WHERE id = $4 AND completed_at IS NULL`,
        [input.action, input.comment ?? null, input.actorId, input.taskId],
      );
    } else if (input.comment) {
      await client.query(
        `UPDATE workflow_tasks SET comment = $1 WHERE id = $2`,
        [input.comment, input.taskId],
      );
    }

    if (input.newTaskRole) {
      await client.query(
        `INSERT INTO workflow_tasks (workflow_id, role) VALUES ($1,$2)`,
        [inst.id, input.newTaskRole],
      );
    }

    await client.query(
      `UPDATE workflow_instances
          SET state = $1, current_step = $2, updated_at = NOW()
        WHERE id = $3`,
      [input.nextState, input.nextStep, inst.id],
    );

    const fresh = await loadByClassification(client, input.classificationId);
    if (!fresh) throw new Error('applyAction: failed to reload workflow');
    return fresh;
  });
}

async function scopeToTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}
