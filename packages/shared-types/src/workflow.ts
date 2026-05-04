import { z } from 'zod';

export const ReviewerRole = z.enum(['legal', 'privacy', 'governance', 'admin']);
export type ReviewerRole = z.infer<typeof ReviewerRole>;

export const WorkflowState = z.enum([
  'pending',
  'in_review',
  'approved',
  'rejected',
  'escalated',
  'cancelled',
]);
export type WorkflowState = z.infer<typeof WorkflowState>;

export const WorkflowAction = z.object({
  workflowId: z.string().uuid(),
  taskId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'comment', 'reassign', 'escalate']),
  comment: z.string().max(8000).optional(),
  reassignTo: z.string().uuid().optional(),
  actorId: z.string().uuid(),
});
export type WorkflowAction = z.infer<typeof WorkflowAction>;
