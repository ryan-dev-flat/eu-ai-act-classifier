import type {
  ClassificationResult,
  ReviewerRole,
  WorkflowAction,
  WorkflowState,
} from '@eu-ai-act/shared-types';

/**
 * Pure module: no I/O. Encodes the approval chain definitions and the allowed
 * transitions per (state, action) pair (architecture §3.2).
 *
 * Chains are intentionally hard-coded for the MVP. Tenant overrides will land
 * via `POST /v1/workflows/rules` once the admin UI is in scope.
 */

export interface ChainStep {
  /** Reviewer role required to act on this step. */
  role: ReviewerRole;
  /** Stable identifier for client display. */
  description: string;
}

export interface ChainDefinition {
  id: string;
  steps: ChainStep[];
}

const CHAIN_HIGH_RISK: ChainDefinition = {
  id: 'high-risk-default-v1',
  steps: [{ role: 'legal', description: 'Legal review for Annex III high-risk classification' }],
};

const CHAIN_GPAI: ChainDefinition = {
  id: 'gpai-default-v1',
  steps: [{ role: 'governance', description: 'Governance review for GPAI obligations' }],
};

const CHAIN_GPAI_SYSTEMIC: ChainDefinition = {
  id: 'gpai-systemic-default-v1',
  steps: [
    { role: 'governance', description: 'Governance review (systemic-risk GPAI)' },
    { role: 'legal', description: 'Legal sign-off (systemic-risk GPAI)' },
  ],
};

/**
 * Lookup table for chains by id. The action route reads the chain definition
 * back from this registry so transitions know how many steps remain.
 */
export const CHAIN_REGISTRY: Readonly<Record<string, ChainDefinition>> = {
  [CHAIN_HIGH_RISK.id]: CHAIN_HIGH_RISK,
  [CHAIN_GPAI.id]: CHAIN_GPAI,
  [CHAIN_GPAI_SYSTEMIC.id]: CHAIN_GPAI_SYSTEMIC,
};

/**
 * Returns the chain to instantiate for a freshly evaluated classification, or
 * null when the risk tier does not require human approval (limited / minimal
 * risk → no workflow; prohibited → blocked upstream, no chain).
 */
export function chainForResult(result: ClassificationResult): ChainDefinition | null {
  switch (result.riskTier) {
    case 'high_risk':
      return CHAIN_HIGH_RISK;
    case 'gpai':
      return CHAIN_GPAI;
    case 'gpai_systemic_risk':
      return CHAIN_GPAI_SYSTEMIC;
    default:
      return null;
  }
}

export type WorkflowActionKind = WorkflowAction['action'];

export interface TransitionContext {
  /** Current persisted state of the workflow instance. */
  state: WorkflowState;
  /** Zero-based index of the active step in the chain. */
  currentStep: number;
  /** Total number of steps in the chain. */
  totalSteps: number;
  /** Role of the actor submitting the action. */
  actorRole: ReviewerRole;
  /** Role required by the active step. */
  requiredRole: ReviewerRole;
  /** Action being applied. */
  action: WorkflowActionKind;
}

export interface TransitionResult {
  nextState: WorkflowState;
  /** Step index for the next active task; equals totalSteps when terminal. */
  nextStep: number;
  /** Whether the active task should be marked completed. */
  completeCurrentTask: boolean;
  /** Whether a new task should be created for nextStep. */
  createNextTask: boolean;
}

const TERMINAL: WorkflowState[] = ['approved', 'rejected', 'cancelled'];

export function isTerminal(state: WorkflowState): boolean {
  return TERMINAL.includes(state);
}

/**
 * Validates and computes the next state. Throws when the action is not
 * permitted from the given state or by the actor's role. Comment / reassign
 * never advance the state — they are persisted separately.
 */
export function transition(ctx: TransitionContext): TransitionResult {
  if (isTerminal(ctx.state)) {
    throw new Error(`workflow is ${ctx.state}; no further actions allowed`);
  }

  if (ctx.action === 'comment' || ctx.action === 'reassign') {
    return {
      nextState: ctx.state,
      nextStep: ctx.currentStep,
      completeCurrentTask: false,
      createNextTask: false,
    };
  }

  if (ctx.actorRole !== ctx.requiredRole && ctx.actorRole !== 'admin') {
    throw new Error(
      `actor role '${ctx.actorRole}' cannot ${ctx.action} a step requiring '${ctx.requiredRole}'`,
    );
  }

  if (ctx.action === 'reject') {
    return { nextState: 'rejected', nextStep: ctx.currentStep, completeCurrentTask: true, createNextTask: false };
  }

  if (ctx.action === 'escalate') {
    return {
      nextState: 'escalated',
      nextStep: ctx.currentStep,
      completeCurrentTask: false,
      createNextTask: false,
    };
  }

  // approve
  const nextStep = ctx.currentStep + 1;
  if (nextStep >= ctx.totalSteps) {
    return { nextState: 'approved', nextStep, completeCurrentTask: true, createNextTask: false };
  }
  return { nextState: 'in_review', nextStep, completeCurrentTask: true, createNextTask: true };
}
