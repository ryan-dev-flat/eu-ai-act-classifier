import type { PoolClient } from '@eu-ai-act/db';
import type { WorkflowInstanceRow, WorkflowTaskRow } from './repository.js';

interface InstanceDbRow {
  id: string;
  classification_id: string;
  state: WorkflowInstanceRow['state'];
  current_step: number;
  chain_definition_id: string;
  created_at: Date;
  updated_at: Date;
}

interface TaskDbRow {
  id: string;
  workflow_id: string;
  role: WorkflowTaskRow['role'];
  assignee_id: string | null;
  action: string | null;
  comment: string | null;
  completed_at: Date | null;
  created_at: Date;
}

export async function loadByClassification(
  client: PoolClient,
  classificationId: string,
): Promise<WorkflowInstanceRow | null> {
  const inst = await client.query<InstanceDbRow>(
    `SELECT id, classification_id, state, current_step, chain_definition_id,
            created_at, updated_at
       FROM workflow_instances
      WHERE classification_id = $1
      LIMIT 1`,
    [classificationId],
  );
  const row = inst.rows[0];
  if (!row) return null;
  const tasks = await client.query<TaskDbRow>(
    `SELECT id, workflow_id, role, assignee_id, action, comment, completed_at, created_at
       FROM workflow_tasks
      WHERE workflow_id = $1
      ORDER BY created_at ASC`,
    [row.id],
  );
  return {
    id: row.id,
    classificationId: row.classification_id,
    state: row.state,
    currentStep: row.current_step,
    chainDefinitionId: row.chain_definition_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    tasks: tasks.rows.map((t) => ({
      id: t.id,
      workflowId: t.workflow_id,
      role: t.role,
      assigneeId: t.assignee_id,
      action: t.action,
      comment: t.comment,
      completedAt: t.completed_at ? t.completed_at.toISOString() : null,
      createdAt: t.created_at.toISOString(),
    })),
  };
}
