import type { ClassificationResult } from '@eu-ai-act/shared-types';

/**
 * Minimal client used by the classification-engine to bootstrap a workflow
 * instance after persisting a high-risk / GPAI result. A full `@eu-ai-act/
 * workflow-client` package will land once a second consumer needs it; for now
 * this module keeps the surface area local.
 */

export interface WorkflowCreationContext {
  tenantId: string;
  userId: string | null;
  /** Forwarded bearer token. Absent in dev-mode flows that rely on headers. */
  authToken?: string | undefined;
  /** Comma-separated roles header, forwarded in dev mode only. */
  roles?: string | undefined;
}

export interface WorkflowCreationResult {
  workflowId: string;
}

export interface WorkflowClient {
  /**
   * Returns null when the result's risk tier does not require human approval.
   * Throws when the workflow service is reachable but rejects the request.
   */
  createForResult(
    classificationId: string,
    result: ClassificationResult,
    ctx: WorkflowCreationContext,
  ): Promise<WorkflowCreationResult | null>;
}

/**
 * Risk tiers that require an approval chain. Mirrors `chainForResult` in the
 * workflow service — kept duplicated here so the classification-engine can
 * short-circuit the network call when no workflow is needed.
 */
const TIERS_REQUIRING_WORKFLOW: ReadonlySet<ClassificationResult['riskTier']> = new Set([
  'high_risk',
  'gpai',
  'gpai_systemic_risk',
]);

export function requiresWorkflow(tier: ClassificationResult['riskTier']): boolean {
  return TIERS_REQUIRING_WORKFLOW.has(tier);
}

export interface HttpWorkflowClientOptions {
  fetchImpl?: typeof fetch;
}

export function createHttpWorkflowClient(
  baseUrl: string,
  options: HttpWorkflowClientOptions = {},
): WorkflowClient {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    async createForResult(classificationId, result, ctx) {
      if (!requiresWorkflow(result.riskTier)) return null;
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (ctx.authToken) {
        headers.authorization = `Bearer ${ctx.authToken}`;
      } else {
        headers['x-tenant-id'] = ctx.tenantId;
        if (ctx.userId) headers['x-user-id'] = ctx.userId;
        if (ctx.roles) headers['x-roles'] = ctx.roles;
      }
      const res = await doFetch(`${baseUrl}/v1/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ classificationId, result }),
      });
      if (!res.ok) {
        throw new Error(`Workflow creation failed: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as { id: string };
      return { workflowId: data.id };
    },
  };
}
